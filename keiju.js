function show(value) { 
  console.log(value)
}
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

function v(x, y) { return new Vector2D(x, y) }
v0 = v(0, 0)

function limitPosition(minX, minY, maxX, maxY) {
  return function(pos, delta) {
    var newPos = pos.add(delta)
    if (newPos.x < minX || newPos.x > maxX || newPos.y < minY || newPos.y > maxY) 
      return pos
    return newPos
  }
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

$(function() {
  var left = keyState(37, v(-1, 0), v0)
  var up = keyState(38, v(0, -1), v0)
  var right = keyState(39, v(1, 0), v0)
  var down = keyState(40, v(0, 1), v0)
  sine = Bacon.interval(20)
              .scan(0, function(prev) { return prev+0.1 })
              .map(function(a) { return Math.sin(a) * 5})
              .map(function(y) { return v(0,y)})
  acceleration = Bacon.combineWith([up, left, right, down], ".add")
  speed = acceleration.sample(20).scan(v0, integrateAcceleration)
  position = speed.sample(20).filter(".isNonZero")
    .scan(v(300,200), limitPosition(0, 0, 640, 405))  
    .combine(sine, ".add")
  fairy = $("#fairy")

  position.onValue( function(pos) { fairy.css( { left : pos.x, top : pos.y } ) } )
})
