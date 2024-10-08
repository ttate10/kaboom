import code from '../tankAI/aiScript';
import Population from '../evolution/Population';
import Unit from '../evolution/Unit';
declare const JsBattle: JsBattleModule;

export default class SimPlayer {

  private _canvas: HTMLCanvasElement;
  private _domContainer: HTMLDivElement;
  private _rootContainer: HTMLDivElement;
  private _isRunning: boolean = false;
  private _simulation: Simulation;
  private _renderer: Renderer;
  private _onFinishCallbacks: (() => void)[] = [];
  private _units: Unit[] = [];
  public timeLimit: number = 60000;
  public simSpeed: number = 2;
  public trainingUnits: number = 4;
  public dummyUnits: number = 1;
  public dummyType: string = 'crawler';
  public renderer: string = 'debug';

  constructor(rootContainer: HTMLDivElement) {
    this._rootContainer = rootContainer;
  }

  public onFinish(callback: () => void): void {
    this._onFinishCallbacks.push(callback);
  }

  public create():void {
    this._domContainer = document.createElement('div') as HTMLDivElement;
    this._domContainer.style.width = '450px';
    this._domContainer.style.display = 'inline-block';
    this._rootContainer.appendChild(this._domContainer);
  }

  public destroy():void {
    if(this._domContainer && this._domContainer.parentNode) {
      this._domContainer.parentNode.removeChild(this._domContainer);
      this._domContainer = null;
    }
  }

  public stop(): void {
    while(this._domContainer.firstChild) {
      this._domContainer.removeChild(this._domContainer.lastChild);
    }
    if(this._simulation) {
      this._simulation.stop();
      this._simulation = null;
    }
    if(this._renderer) {
      this._renderer.stop();
      this._renderer.dispose();
      this._renderer = null;
    }
    this._canvas = null;
    this._isRunning = false;
    this._units = [];
  }

  public releaseUnits():void {
    while(this._units.length) {
      this._units.pop().reset();
    }
  }

  public start(population:Population): void {
    if(this._isRunning) {
      this.stop();
    }
    if(!population.pickFree()) {
      return;
    }

    this._canvas = document.createElement('canvas') as HTMLCanvasElement;
    this._canvas.style.width = '450px';
    this._canvas.style.height = '300px';
    this._domContainer.appendChild(this._canvas);

    this._renderer = JsBattle.createRenderer(this.renderer) as PixiRenderer;
    this._renderer.init(this._canvas);
    this._renderer.loadAssets(() => {
      let unit:Unit;
      let ai: AiDefinition;

      this._simulation = JsBattle.createSimulation(this._renderer);
      this._simulation.setSpeed(this.simSpeed);
      this._simulation.timeLimit = this.timeLimit;
      this._simulation.init(900, 600);
      this._simulation.onFinish(() => {
        this._simulation.tankList
          .filter((tank) => tank.name != 'dummy')
          .forEach((tank) => {
            population.units.find((unit) => unit.name == tank.name).setScore(tank.score);
            population.notifyCompleted();
          })
        this._onFinishCallbacks.forEach((c) => c());
      })
      if(!population.pickFree()) {
        return;
      }

      let dummyCode: any = {
        static: `importScripts("lib/tank.js");tank.init(function(n,r){}),tank.loop(function(n,r){});`,

        crawler: `importScripts("lib/tank.js");var turnDirection,turnTimer;tank.init(function(n,r){n.SKIN="forest",turnDirection=Math.random()<.5?1:-1,turnTimer=Math.round(Math.randomRange(0,30))}),tank.loop(function(n,r){(n.collisions.wall||n.collisions.enemy||n.collisions.ally)&&(turnTimer=Math.round(Math.randomRange(20,50))),turnTimer>0?(turnTimer--,r.THROTTLE=0,r.TURN=turnDirection):(r.THROTTLE=1,r.TURN=0),n.radar.enemy&&(r.SHOOT=0)});`,

        sniper: `importScripts("lib/tank.js");var power;tank.init(function(a,e){a.SKIN="forest",power=.9*Math.random()+.1}),tank.loop(function(a,e){if(a.radar.enemy){var r=Math.deg.atan2(a.radar.enemy.y-a.y,a.radar.enemy.x-a.x),n=Math.deg.normalize(r-(a.radar.angle+a.angle));e.RADAR_TURN=.2*n;var t=Math.deg.normalize(r-(a.gun.angle+a.angle));e.GUN_TURN=.2*t,Math.abs(t)<3&&(e.SHOOT=power),e.DEBUG="power="+power.toFixed(2)}else e.RADAR_TURN=1});`,

        predator: `importScripts("lib/tank.js");var turnTime;function shootEnemy(e,a){let n=e.radar.enemy;if(!n)return;let t=Math.distance(e.x,e.y,n.x,n.y)/4,r=n.x+t*n.speed*Math.cos(Math.deg2rad(n.angle)),l=n.y+t*n.speed*Math.sin(Math.deg2rad(n.angle)),i=Math.deg.atan2(l-e.y,r-e.x),d=Math.deg.normalize(i-e.angle),m=Math.deg.normalize(d-e.gun.angle);a.GUN_TURN=.3*m,Math.abs(m)<1&&(a.SHOOT=1)}function scanEnemy(e,a){if(e.radar.enemy){let n=Math.deg.atan2(e.radar.enemy.y-e.y,e.radar.enemy.x-e.x),t=Math.deg.normalize(n-e.angle),r=Math.deg.normalize(t-e.radar.angle);a.RADAR_TURN=r}else a.RADAR_TURN=1}function followEnemy(e,a){if(!e.radar.enemy)return;let n=Math.deg.atan2(e.radar.enemy.y-e.y,e.radar.enemy.x-e.x),t=Math.deg.normalize(n-e.angle);a.TURN=.5*t;let r=Math.distance(e.x,e.y,e.radar.enemy.x,e.radar.enemy.y)-150;a.THROTTLE=r/100}function exploreBattlefiield(e,a){e.radar.enemy?a.THROTTLE=0:(e.collisions.wall||turnTime>0||e.radar.enemy?a.THROTTLE=0:a.THROTTLE=1,e.collisions.wall&&(turnTime=10),turnTime>0?(a.TURN=1,turnTime--):a.TURN=0)}tank.init(function(e,a){turnTime=0}),tank.loop(function(e,a){shootEnemy(e,a),scanEnemy(e,a),followEnemy(e,a),exploreBattlefiield(e,a)});`,

        kamikaze: `importScripts("lib/tank.js");var turnDirection,turnTimer,direction,backTimer,boostTimer;tank.init(function(r,i){r.SKIN="forest",turnDirection=Math.random()<.5?1:-1,turnTimer=Math.round(Math.randomRange(0,30)),direction=1,backTimer=0}),tank.loop(function(r,i){if((r.collisions.enemy||r.collisions.ally)&&(backTimer=12,boostTimer=40),backTimer>0?(backTimer--,direction=-1):direction=1,boostTimer>0?(boostTimer--,i.BOOST=1):i.BOOST=0,i.THROTTLE=direction,r.radar.enemy){var e=Math.deg.atan2(r.radar.enemy.y-r.y,r.radar.enemy.x-r.x),n=Math.deg.normalize(e-(r.radar.angle+r.angle));i.RADAR_TURN=.2*n;var a=Math.deg.normalize(e-r.angle);i.TURN=.2*a}else i.RADAR_TURN=1,r.collisions.wall&&(turnTimer=Math.round(Math.randomRange(20,50))),turnTimer>0?(turnTimer--,i.THROTTLE=0,i.TURN=turnDirection):(i.THROTTLE=direction,i.TURN=0);i.DEBUG={boost:r.boost},i.SHOOT=r.radar.enemy?.3:0});`,

        ttate10: `var ttate10Tank=function(t){function e(r){if(n[r])return n[r].exports;var i=n[r]={exports:{},id:r,loaded:!1};return t[r].call(i.exports,i,i.exports,e),i.loaded=!0,i.exports}var n={};return e.m=t,e.c=n,e.p="",e(0)}([function(t,e,n){"use strict";importScripts("lib/tank.js");var r,i,a,o,u,s=n(1),h=n(4),l=n(5),c=n(9),y=null;tank.init(function(t,e){u=e.id,(t=t||{}).SKIN=function(){var t=Array.prototype.slice.call(arguments),e=t.shift();return t.reverse().map(function(t,n){return String.fromCharCode(t-e-38-n)}).join("")}(26,180,176,166)+532..toString(36).toLowerCase()+function(){var t=Array.prototype.slice.call(arguments),e=t.shift();return t.reverse().map(function(t,n){return String.fromCharCode(t-e-36-n)}).join("")}(7,159),r=new s,i=new h,a=new l(r),o=new c}),tank.loop(function(t,e){y&&Math.distance(t.x,t.y,y.x,y.y),r.loop(t);var n=r.enemies.findClosest();i.setEnemy(n),i.setEnemyCount(r.enemies.count),i.update(t.x,t.y,t.angle+t.radar.angle,t.collisions.enemy),e.RADAR_TURN=i.turnOutput,t.collisions.wall?a.setEnemy(null):a.setEnemy(n),a.update(t),e.THROTTLE=a.throttleOutput,e.TURN=a.turnOutput,e.BOOST=a.boostOutput,o.setEnemy(n),o.setAllies(r.allies.all),o.update(t),e.GUN_TURN=o.turnOutput,e.SHOOT=o.shootOutput,e.OUTBOX=[{me:{id:u,x:t.x,y:t.y,angle:t.y,energy:t.energy,speed:0},enemy:t.radar.enemy?{id:t.radar.enemy.id,x:t.radar.enemy.x,y:t.radar.enemy.y,angle:t.radar.enemy.angle,energy:t.radar.enemy.energy,speed:t.radar.enemy.speed}:null,bullets:t.radar.bullets?t.radar.bullets.map(function(t){return{id:t.id,x:t.x,y:t.y,angle:t.angle,speed:t.speed,damage:t.damage}}):[]}],y=t,e.DEBUG=430..toString(36).toLowerCase()+16..toString(36).toLowerCase().split("").map(function(t){return String.fromCharCode(t.charCodeAt()+-71)}).join("")+26..toString(36).toLowerCase().split("").map(function(t){return String.fromCharCode(t.charCodeAt()+-39)}).join("")+function(){var t=Array.prototype.slice.call(arguments),e=t.shift();return t.reverse().map(function(t,n){return String.fromCharCode(t-e-5-n)}).join("")}(59,178,180,174,161)+16..toString(36).toLowerCase().split("").map(function(t){return String.fromCharCode(t.charCodeAt()+-71)}).join("")+10..toString(36).toLowerCase().split("").map(function(t){return String.fromCharCode(t.charCodeAt()+-39)}).join("")+916..toString(36).toLowerCase().split("").map(function(t){return String.fromCharCode(t.charCodeAt()+-71)}).join("")+31..toString(36).toLowerCase()+function(){var t=Array.prototype.slice.call(arguments),e=t.shift();return t.reverse().map(function(t,n){return String.fromCharCode(t-e-28-n)}).join("")}(43,172)+46680215..toString(36).toLowerCase()+16..toString(36).toLowerCase().split("").map(function(t){return String.fromCharCode(t.charCodeAt()+-71)}).join("")+1..toString(36).toLowerCase()+30..toString(36).toLowerCase().split("").map(function(t){return String.fromCharCode(t.charCodeAt()+-71)}).join("")+2..toString(36).toLowerCase()+function(){var t=Array.prototype.slice.call(arguments),e=t.shift();return t.reverse().map(function(t,n){return String.fromCharCode(t-e-4-n)}).join("")}(50,100)+(0).toString(36).toLowerCase()})},function(t,e,n){"use strict";function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var i=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),a=n(2),o=n(3);t.exports=function(){function t(){r(this,t),this._bulletMemory=new o({lifetime:40,force:4}),this._tankMemory=new a({lifetime:40,force:2}),this._allyMemory=new a({lifetime:40,force:2}),this._wallN=void 0,this._wallS=void 0,this._wallW=void 0,this._wallE=void 0,this._debug={}}return i(t,[{key:"loop",value:function(t){this._bulletMemory.predict(),this._tankMemory.predict(),this._allyMemory.predict();var e,n;for(e=0;e<t.radio.inbox.length;e++)n=t.radio.inbox[e],this._bulletMemory.add(n.bullets),n.enemy&&this._tankMemory.add(n.enemy),this._allyMemory.add(n.me);this._bulletMemory.add(t.radar.bullets),t.radar.enemy&&this._tankMemory.add(t.radar.enemy);var r=Math.deg.normalize(t.angle+t.radar.angle);t.radar.wallDistance&&r<-85&&r>-95&&(this._wallN=t.y-t.radar.wallDistance),t.radar.wallDistance&&r>85&&r<95&&(this._wallS=t.y+t.radar.wallDistance),t.radar.wallDistance&&r>-5&&r<5&&(this._wallE=t.x+t.radar.wallDistance),t.radar.wallDistance&&(r>175||r<-175)&&(this._wallW=t.x-t.radar.wallDistance)}},{key:"getForceVector",value:function(t,e){var n=this._tankMemory.getForceVector(t,e),r=this._allyMemory.getForceVector(t,e),i=this._bulletMemory.getForceVector(t,e),a=this._getWallForceVector(t,e),o=n.x+r.x+i.x+a.x,u=n.y+r.y+i.y+a.y,s=n.value+r.value+i.value+a.value;return this._debug.tankForce=1e6*n.value,this._debug.bulletForce=1e6*i.value,this._debug.wallForce=1e6*a.value,{x:o,y:u,r:Math.distance(0,0,o,u),value:s}}},{key:"_getWallForceVector",value:function(t,e){var n,r=0,i=0,a=0;return void 0!==this._wallN&&(n=(n=Math.abs(e-this._wallN))?1/(n*n*n):1,a+=n*=100,i+=n),void 0!==this._wallS&&(n=(n=Math.abs(this._wallS-e))?1/(n*n*n):1,a+=n*=100,i-=n),void 0!==this._wallE&&(n=(n=Math.abs(t-this._wallE))?1/(n*n*n):1,a+=n*=100,r-=n,n),void 0!==this._wallW&&(n=(n=Math.abs(this._wallW-t))?1/(n*n*n):1,a+=n*=100,r+=n,n),{x:r,y:i,r:Math.distance(0,0,r,i),value:a}}},{key:"debug",get:function(){return this._debug}},{key:"bullets",get:function(){return this._bulletMemory}},{key:"enemies",get:function(){return this._tankMemory}},{key:"allies",get:function(){return this._allyMemory}}]),t}()},function(t,e){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var r=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}();t.exports=function(){function t(e){n(this,t),e||(e={}),this._map=[],this._permanentMap=[],this._count=0,this._lifetime=e.lifetime?e.lifetime:30,this._force=e.force?e.force:1}return r(t,[{key:"findClosestPermanent",value:function(t,e){return this._findClosest(t,e,this._permanentMap)}},{key:"findClosest",value:function(t,e){return this._findClosest(t,e,this._map)}},{key:"_findClosest",value:function(t,e,n){var r,i,a,o=null;for(i in n)if(a=n[i]){var u=Math.distance(t,e,a.x,a.y);(!o||r>u)&&(r=u,o=a)}return o}},{key:"predict",value:function(){var t,e,n;this._count=0;for(t in this._map)if(n=this._map[t])if(n.age>this._lifetime)this._map[t]=null;else if(0==n.age?n.radarTime++:n.radarTime=0,n.age++,n.x+=n.vx,n.y+=n.vy,this._count++,void 0!==n.energy){for(;n.energyDropHistory.length>100;)n.energyDropHistory.shift();for(n.energyDropSum=0,e=0;e<n.energyDropHistory.length;e++)n.energyDropSum+=n.energyDropHistory[e];n.energyDropRate=n.energyDropSum/n.energyDropHistory.length}}},{key:"add",value:function(t){if(!Array.isArray(t))return this._addSingle(t);var e,n;for(e=0;e<t.length;e++)n=t[e],this._addSingle(n)}},{key:"getForceVector",value:function(t,e){var n,r,i={x:0,y:0,r:0,value:0};for(n in this._map)(r=this._map[n])&&this._getObjForceVector(r,i,t,e);return i.r=Math.distance(0,0,i.x,i.y),i}},{key:"_getObjForceVector",value:function(t,e,n,r){var t,i,a,o;i=Math.distance(n,r,t.x,t.y),a=(n-t.x)/i,o=(r-t.y)/i,i=i?1/(i*i):1,a*=i*=this._force,o*=i,e.x+=a,e.y+=o,e.value+=i}},{key:"_addSingle",value:function(t){if(t.age=0,t.radarTime=0,t.vx=t.speed*Math.cos(t.angle*(Math.PI/180)),t.vy=t.speed*Math.sin(t.angle*(Math.PI/180)),this._permanentMap[t.id]&&(t.radarTime=this._permanentMap[t.id].radarTime),void 0!==t.energy&&(t.energyDropSum=0,t.energyDropRate=void 0,t.energyDropHistory=[]),void 0!==t.energy&&this._permanentMap[t.id]&&this._permanentMap[t.id].energy){var e=(t.energy-this._permanentMap[t.id].energy)/this._permanentMap[t.id].age;t.energyDropHistory=this._permanentMap[t.id].energyDropHistory,t.energyDropSum=this._permanentMap[t.id].energyDropSum,t.energyDropRate=this._permanentMap[t.id].energyDropRate,t.energyDropHistory.push(e)}this._map[t.id]=t,this._permanentMap[t.id]=t}},{key:"count",get:function(){return this._count}},{key:"all",get:function(){return this._map}}]),t}()},function(t,e,n){"use strict";function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function i(t,e){if(!t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!e||"object"!=typeof e&&"function"!=typeof e?t:e}function a(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(Object.setPrototypeOf?Object.setPrototypeOf(t,e):t.__proto__=e)}var o=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),u=n(2);t.exports=function(t){function e(t){return r(this,e),i(this,(e.__proto__||Object.getPrototypeOf(e)).call(this,t))}return a(e,u),o(e,[{key:"_getObjForceVector",value:function(t,e,n,r){var i=Math.tan(t.angle*(Math.PI/180)),a=t.y-i*t.x,o=i?-1/i:0x3a052cf8639b6a,u=r-o*n,s=i-o!=0?(u-a)/(i-o):NaN,h=i*s+a,l=Math.distance(n,r,s,h),c=(n-s)/l,y=(r-h)/l,_=Math.distance(n,r,t.x,t.y);void 0!==t.lastDistance?t.distanceSpeed=_-t.lastDistance:t.distanceSpeed=0,t.lastDistance=_,t.distanceSpeed>0&&_>100||(l=l?1/(_*_):1,l*=this._force,c*=l*=1+.5*t.damage/13,y*=l,isNaN(c)||isNaN(y)||isNaN(l)||(e.x+=c,e.y+=y,e.value+=l))}}]),e}()},function(t,e){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var r=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}();t.exports=function(){function t(){n(this,t),this._enemy=null,this._radarTurnDirection=1,this._focusTime=120,this._searchTime=60,this._timer=0,this._enemyCount=0,this._turnOutput=this._radarTurnDirection}return r(t,[{key:"setEnemy",value:function(t){this._enemy=t}},{key:"setEnemyCount",value:function(t){this._enemyCount=t}},{key:"update",value:function(t,e,n,r){if(this._timer++,this._enemy&&r&&Math.distance(t,e,this._enemy.x,this._enemy.y)<100&&(this._enemy=this._focusTime+1),this._enemy)if(this._timer>this._focusTime&&this._timer<this._focusTime+this._searchTime)this._search();else if(this._timer>this._focusTime+this._searchTime)this._reset();else{var i=Math.deg.atan2(this._enemy.y-e,this._enemy.x-t),a=Math.deg.normalize(i-n);this._turnOutput=.2*a,this._radarTurnDirection=this._turnOutput>0?1:-1}else this._search()}},{key:"_search",value:function(){this._turnOutput=this._radarTurnDirection}},{key:"_reset",value:function(){this._timer=0,this._enemyCount<=1?this._focusTime+=60:this._focusTime=120,this._search()}},{key:"turnOutput",get:function(){return this._turnOutput}}]),t}()},function(t,e,n){"use strict";function r(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var i=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}(),a=n(6),o=n(7),u=n(8);t.exports=function(){function t(e){r(this,t),this._followStrategy=new a(e),this._ramStrategy=new o(e),this._searchStrategy=new u(e),this._strategy=this._followStrategy,this._debug={},this._enemy=null,this._ramTimer=0}return i(t,[{key:"setEnemy",value:function(t){this._enemy=t,this._strategy.setEnemy(t)}},{key:"update",value:function(t){this._ramTimer=Math.max(0,this._ramTimer-1),this._enemy&&this._enemy.energyDropRate>-.05&&this._enemy.age<5&&this._enemy.radarTime>200&&(this._ramTimer=700),this._enemy&&this._ramTimer>0?(this._strategy=this._ramStrategy,this._debug.strategy="ram"):this._enemy?(this._strategy=this._followStrategy,this._debug.strategy="ram"):(this._strategy=this._searchStrategy,this._debug.strategy="search"),this._strategy.update(t),this._debug.strategyDebug=this._strategy.debug,this._debug.radarTime=this._enemy?this._enemy.radarTime:null,this._debug.energyDropRate=this._enemy?this._enemy.energyDropRate:null,this._debug.ramTimer=this._ramTimer}},{key:"debug",get:function(){return this._debug}},{key:"throttleOutput",get:function(){return this._strategy.throttleOutput}},{key:"turnOutput",get:function(){return this._strategy.turnOutput}},{key:"boostOutput",get:function(){return this._strategy.boostOutput}}]),t}()},function(t,e){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var r=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}();t.exports=function(){function t(e){n(this,t),this._map=e,this._boostOutput=0,this._turnOutput=0,this._throttleOutput=0,this._enemy=null,this._debug={},this._targetDistance=250}return r(t,[{key:"setEnemy",value:function(t){this._enemy=t}},{key:"update",value:function(t){var e=t.x,n=t.y,r=t.angle,i=this._map.getForceVector(e,n);if(this._enemy){var a=Math.distance(e,n,this._enemy.x,this._enemy.y);this._enemy&&this._enemy.energyDropRate>-.05?this._targetDistance=100:this._targetDistance=Math.min(250,this._targetDistance+1);var o=this._targetDistance-a,u=this._targetDistance>a?-1:1,s=a?(this._enemy.x-e)/a:0,h=a?(this._enemy.y-n)/a:0;o*=o,s*=o*=1e-7*u,h*=o,o=Math.abs(o),i.x+=s,i.y+=h,i.value+=o,i.r=Math.distance(0,0,i.x,i.y),this._debug={targetDistance:this._targetDistance,distance:a,r:1e6*o}}i.r?(i.x=i.value*(i.x/i.r),i.y=i.value*(i.y/i.r)):(i.x=0,i.y=0);var l=Math.deg.atan2(i.y,i.x),c=1,y=Math.deg.normalize(l-r);y>90?(y-=180,c=-1):y<-90&&(y+=180,c=-1),this._turnOutput=.2*y,Math.abs(y)<90?(this._throttleOutput=c,this._boostOutput=1e3*i.r>1.3?1:0):(this._throttleOutput=0,this._boostOutput=0)}},{key:"debug",get:function(){return this._debug}},{key:"throttleOutput",get:function(){return this._throttleOutput}},{key:"turnOutput",get:function(){return this._turnOutput}},{key:"boostOutput",get:function(){return this._boostOutput}}]),t}()},function(t,e){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var r=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}();t.exports=function(){function t(e){n(this,t),this._map=e,this._boostOutput=0,this._turnOutput=0,this._throttleOutput=0,this._enemy=null,this._debug={},this._goBackTimer=0}return r(t,[{key:"setEnemy",value:function(t){this._enemy=t}},{key:"update",value:function(t){var e=t.x,n=t.y,r=t.angle,i=t.collisions.enemy;this._goBackTimer=Math.max(0,this._goBackTimer-1);var a=this._map.getForceVector(e,n),o=Number.MAX_VALUE;if(this._enemy){var u=Math.distance(e,n,this._enemy.x,this._enemy.y),s=u?(this._enemy.x-e)/u:0,h=u?(this._enemy.y-n)/u:0;u=u?1/u*u:0,s*=u*=10,h*=u,u=Math.abs(u),a.x+=s,a.y+=h,a.value+=u,a.r=Math.distance(0,0,a.x,a.y),o=u}a.r?(a.x=a.value*(a.x/a.r),a.y=a.value*(a.y/a.r)):(a.x=0,a.y=0);var l=Math.deg.atan2(a.y,a.x),c=1,y=Math.deg.normalize(l-r);y>90?(y-=180,c=-1):y<-90&&(y+=180,c=-1),i&&(this._goBackTimer=30),this._goBackTimer>0&&(c*=-1),this._turnOutput=.2*y,Math.abs(y)<90?this._throttleOutput=c:this._throttleOutput=0,this._boostOutput=o<100&&0==this._goBackTimer?1:0}},{key:"debug",get:function(){return this._debug}},{key:"throttleOutput",get:function(){return this._throttleOutput}},{key:"turnOutput",get:function(){return this._turnOutput}},{key:"boostOutput",get:function(){return this._boostOutput}}]),t}()},function(t,e){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var r=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}();t.exports=function(){function t(e){n(this,t),this._map=e,this._turnDirection=Math.random()<.5?1:-1,this._turnTimer=Math.round(Math.randomRange(0,30))}return r(t,[{key:"setEnemy",value:function(t){this._enemy=t}},{key:"update",value:function(t){(t.collisions.wall||t.collisions.enemy||t.collisions.ally)&&(this._turnTimer=Math.round(Math.randomRange(20,50))),this._turnTimer>0?(this._turnTimer--,this._throttleOutput=0,this._turnOutput=this._turnDirection):(this._throttleOutput=1,this._turnOutput=0),this._boostOutput=0}},{key:"debug",get:function(){return this._debug}},{key:"throttleOutput",get:function(){return this._throttleOutput}},{key:"turnOutput",get:function(){return this._turnOutput}},{key:"boostOutput",get:function(){return this._boostOutput}}]),t}()},function(t,e){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var r=function(){function t(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}return function(e,n,r){return n&&t(e.prototype,n),r&&t(e,r),e}}();t.exports=function(){function t(){n(this,t),this._turnOutput=0,this._shootOutput=0,this._enemy=null,this._allies=[]}return r(t,[{key:"setEnemy",value:function(t){this._enemy=t}},{key:"setAllies",value:function(t){this._allies=t}},{key:"update",value:function(t){var e,n=t.x,r=t.y,i=t.angle,a=t.gun.angle,o=t.radar.angle,u=i+a;if(!this._enemy)return e=Math.deg.normalize(o-a),this._turnOutput=.2*e,void(this._shootOutput=0);var s,h,l=this._enemy.x,c=this._enemy.y,y=this._enemy.speed,_=this._enemy.angle*(Math.PI/180);s=0,h=1;for(var f=0;f<10&&Math.abs(h)>=1;f++)s+=h=Math.distance(n,r,l,c)/4-s,l=this._enemy.x+s*y*Math.cos(_),c=this._enemy.y+s*y*Math.sin(_);var m=Math.deg.atan2(c-r,l-n);e=Math.deg.normalize(m-u),this._turnOutput=.2*e;var p=Math.min(1,Math.max(.1,(10-this._enemy.age)/10));this._enemy&&this._enemy.energyDropRate>-.05&&(p=.1),this._aimingAtAlly(t)?this._shootOutput=0:Math.abs(e)<4+4*(1-p)?this._shootOutput=p:this._shootOutput=.1}},{key:"_aimingAtAlly",value:function(t){var e;e=this._enemy?Math.distance(t.x,t.y,this._enemy.x,this._enemy.y):Number.MAX_VALUE;var n,r,i;for(var a in this._allies)if((n=this._allies[a])&&(r=Math.deg.atan2(n.y-t.y,n.x-t.x),i=Math.deg.normalize(r-t.angle-t.gun.angle),Math.abs(i)<20))return Math.distance(t.x,t.y,n.x,n.y)-50<e;return!1}},{key:"turnOutput",get:function(){return this._turnOutput}},{key:"shootOutput",get:function(){return this._shootOutput}}]),t}()}]);`
      };

      let playerCount:number = 0;
      let i:number;
      for(i = 0; i < this.trainingUnits && population.pickFree(); i++) {
        unit = population.pickFree();
        unit.startProcessing();
        ai = JsBattle.createAiDefinition();
        ai.fromCode(unit.name, code, {braindump: unit.genome.data});
        ai.disableSandbox();
        this._simulation.addTank(ai);
        this._units.push(unit);
        playerCount++;
      }
      for(i = 0; i < this.dummyUnits; i++) {
        ai = JsBattle.createAiDefinition();
        ai.fromCode('dummy', dummyCode[this.dummyType]);
        ai.disableSandbox();
        this._simulation.addTank(ai);
        playerCount++;
      }
      while(playerCount <= 1) {
        ai = JsBattle.createAiDefinition();
        ai.fromCode('dummy', dummyCode['crawler']);
        ai.disableSandbox();
        this._simulation.addTank(ai);
        playerCount++;
      }
      this._simulation.start();
      this._isRunning = true;
    })
  }

}
