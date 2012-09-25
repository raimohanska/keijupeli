$(function() {
  World = {
    tickInteval: 20,
    width: 800,
    height: 600
  }
  setElementSize($("#sky"), World)
  var controller = KeyboardController().combine(TouchController($("#fairy")), ".add")
  var fairy = Fairy(controller)
  Spaceman(fairy.position)
  Sun()
  if (!isTouchDevice()) {
    $("#instructions").fadeIn(1000)
    Bacon.later(3000).onValue(function() {
      $("#instructions").fadeOut(1000)
    })
  }
})

function isTouchDevice() {
    return "ontouchstart" in window;
}

function KeyboardController() {
  function keyUps(keyCode) { 
    return $("body").asEventStream("keyup").filter(function(e) { return e.keyCode == keyCode }) 
  }
  function keyDowns(keyCode) { 
    return $("body").asEventStream("keydown").filter(function(e) { return e.keyCode == keyCode }) 
  }
  function keyState(keyCode, downValue, upValue) { 
    return keyDowns(keyCode).map(downValue)
    .merge(keyUps(keyCode).map(upValue)).toProperty(upValue) 
  }
  var left = keyState(37, v(-1, 0), v0)
  var up = keyState(38, v(0, -1), v0)
  var right = keyState(39, v(1, 0), v0)
  var down = keyState(40, v(0, 1), v0)
  return Bacon.combineWith([up, left, right, down], ".add")
}

function TouchController(elem) {
  function singleTouch(event) { return event.targetTouches.length == 1 }
  function touchCoords(touchEvent) {
    var touch = touchEvent.targetTouches[0]
    return v(touch.clientX, touch.clientY)
  }
  function elemPos() {
    var elemPos = elem.position()
    return v(elemPos.left, elemPos.top)
  }
  return elem.asEventStream("touchstart").map(".originalEvent").do(".preventDefault").filter(singleTouch).map(touchCoords).switch(function(startPos) {
    var elemStartPos = elemPos()
    return elem.asEventStream("touchmove").map(".originalEvent").do(".preventDefault").takeUntil(elem.asEventStream("touchend"))
      .map(touchCoords).map(function(movePos) {
        var deltaPos = movePos.subtract(startPos)
        var elemTargetPos = elemStartPos.add(deltaPos)
        var distanceToTarget = elemTargetPos.subtract(elemPos())
        var move = distanceToTarget.withLength(1)
        return move
      }).mapEnd(v0)
  }).toProperty(v0)
}

function Fairy(acceleration) {
  var dimensions = {
    width: 160,
    height: 203
  }
  var speed = acceleration.sample(World.tickInteval).scan(v0, integrateAcceleration)
  var startPos = v(World.width / 2 - dimensions.width / 2, World.height / 2 - dimensions.height / 2)
  var position = speed.sample(World.tickInteval).filter(".isNonZero")
    .scan(startPos, limitPosition(dimensions))  
    .combine(sine(5, .1, 1).map(function(y) { return v(0,y)}), ".add")
  var fairy = $("#fairy")

  setElementSize(fairy, dimensions)
  position.onValue( function(pos) { fairy.css( { left : pos.x, top : pos.y } ) } )
  wobble(fairy, sine(3, .1, 2))
  return { position: position }
}

function setElementSize(elem, dimensions) {
  elem.css({width: dimensions.width, height: dimensions.height, "background-size": dimensions.width + " " + dimensions.height})
}

function rotate(thing) {
  return function(degree) {
     thing.css({ WebkitTransform: 'rotate(' + degree + 'deg)'});
     thing.css({ '-moz-transform': 'rotate(' + degree + 'deg)'});
  }
}

function wobble(thing, angle) {
  angle.onValue(rotate(thing))
}

function Sun() {
  linear(0, .3).onValue(rotate($("#sun")))
}

function Spaceman(fairyPos) {
  var dimensions = {
    width: 120,
    height: 196
  }
  var spaceman = $("#spaceman")
  spaceman.css({left:100, top:100})
  wobble(spaceman, sine(10, .1, 0))
  var position = fairyPos.changes().scan(v(100, 100), function(prev, fairyPos) {
    var distanceFromFairy = fairyPos.subtract(prev)
    var diffToRadius = distanceFromFairy.getLength() - 180
    var move
    if (Math.abs(diffToRadius) < 5) {
      // circle around
      move = distanceFromFairy.rotateDeg(90).withLength(3)
    } else if (diffToRadius > 0) {
      // chase
      move = distanceFromFairy.withLength(1)
    } else {
      // flee
      move = distanceFromFairy.withLength(-2)
    }
    var newPos = prev.add(move)
    return (outOfBounds(newPos, dimensions)) ? prev : newPos
  })
  setElementSize(spaceman, dimensions)
  position.onValue( function(pos) { spaceman.css( { left : pos.x, top : pos.y } ) } )
  var tickle = spaceman.asEventStream("click").merge(spaceman.asEventStream("touchstart").map(".originalEvent").do(".preventDefault"))
  tickle.onValue(audio.playSound("ala-kiusaa-minua"))
  tickle.delay(5000).onValue(audio.playSound("avaruusmies"))
  return { position: position}
}


function v(x, y) { return new Vector2D(x, y) }
v0 = v(0, 0)

function limitPosition(dimensions) {
  return function(pos, delta) {
    var newPos = pos.add(delta)
    if (outOfBounds(newPos, dimensions))
      return pos
    return newPos
  }
}

function outOfBounds(pos, dimensions) {
  return (pos.x < 0 || pos.x > World.width - dimensions.width || pos.y < 0 || pos.y > World.height - dimensions.height) 
}


function integrateAcceleration(curSpeed, dir) { 
  var maxSpeed = 5
  var deceleration = 1
  if (dir.isZero()) {
    if (curSpeed.getLength() > deceleration) {
      return curSpeed.withLength(curSpeed.getLength() - deceleration)
    } else {
      return v0
    }
  } else {
    var newSpeed = curSpeed.add(dir)
    if (newSpeed.getLength() <= maxSpeed) {
      return newSpeed
    } else {
      return newSpeed.withLength(maxSpeed)
    }
  }
}

function linear(start, speed) {
  return Bacon.interval(World.tickInteval)
    .scan(start, function(prev) { return prev + speed })
}

function sine(amplitude, frequency, phase) {
  return linear(phase, frequency)
    .map(function(a) { return Math.sin(a) * amplitude})
}

audio = Audio()
function Audio() {
  var on = true
  var sounds = {}

  function loadSound(soundName) {
    var audioElement = document.createElement('audio')
    audioElement.setAttribute('src', "audio/" + soundName + ".mp3")
    return audioElement
  }

  function getSound(soundName) {
    if (!sounds[soundName]) {
      sounds[soundName] = loadSound(soundName)
    }
    return sounds[soundName]
  }
  function play(soundName) {
    if (on) getSound(soundName).play()
  }
  return {
    playSound : function(soundName) { return function() { play(soundName) }},
    toggle : function() { on = !on; }
  }
}
