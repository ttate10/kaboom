import Population from "./evolution/Population";
import config from './config';
import code from './tankAI/aiScript';

declare const JsBattle: JsBattleModule;

export class PreviewApp {

  private _population: Population;
  private _domContainer: HTMLDivElement;
  private _isRunning: boolean = false;
  private _simulation: Simulation;
  private _renderer: Renderer;
  private _canvas: HTMLCanvasElement;
  private _backButton: HTMLButtonElement;
  private _copyButton: HTMLButtonElement;
  private _codeContainer: HTMLTextAreaElement;

  constructor() {
    document.body.innerHTML = '';

    this._population = new Population();
    this._population.create(config.populationSize);
    this._population.load(config.populationName);

    this._backButton = document.createElement('button') as HTMLButtonElement;
    this._backButton.classList.add('back');
    this._backButton.innerText = "<< Go Back";
    document.body.appendChild(this._backButton);
    this._backButton.onclick = ():void => {
      window.location.replace('/#sim');
      window.location.reload();
    };
    this._copyButton = document.createElement('button') as HTMLButtonElement;
    this._copyButton.classList.add('copy');
    this._copyButton.innerText = "Copy Script to the Clipboard";
    document.body.appendChild(this._copyButton);
    this._copyButton.onclick = ():void => {
      this._codeContainer.select();
      document.execCommand('copy');
    };
    document.body.appendChild(document.createElement('br'));

    this._domContainer = document.createElement('div') as HTMLDivElement;
    this._domContainer.style.width = '450px';
    this._domContainer.style.display = 'inline-block';
    document.body.appendChild(this._domContainer);

    this.start();
  }

  public stop() :void {
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
  }

  public start() :void {
    if(this._isRunning) {
      this.stop();
    }

    this._canvas = document.createElement('canvas') as HTMLCanvasElement;
    this._canvas.style.width = '600px';
    this._canvas.style.height = '400px';
    this._domContainer.appendChild(this._canvas);

    this._codeContainer = document.createElement('textarea') as HTMLTextAreaElement;
    this._domContainer.appendChild(this._codeContainer);
    let brainData:string = JSON.stringify(Array.from(new Uint8Array(this._population.bestGenome.data)))
    brainData = `new Uint8Array(${brainData}).buffer`;
    this._codeContainer.innerText = code.replace(/ai\.init\(settings, info\)/, 'ai.init(settings, {initData: { braindump: ' + brainData + '}})');
    this._codeContainer.style.width = '600px'
    this._codeContainer.style.height = '400px'
    this._codeContainer.id = 'aiscript'

    this._renderer = JsBattle.createRenderer('debug') as PixiRenderer;
    this._renderer.init(this._canvas);
    this._renderer.loadAssets(() => {
      let ai: AiDefinition;

      this._simulation = JsBattle.createSimulation(this._renderer);
      this._simulation.setSpeed(1);
      this._simulation.init(900, 600);
      this._simulation.onFinish(() => {
        this.stop();
        this.start();
      })

      let i:number;
      for(i = 0; i < 3; i++) {
        ai = JsBattle.createAiDefinition();
        ai.fromCode('kaboom', code, {braindump: this._population.bestGenome.data});
        this._simulation.addTank(ai);

        ai = JsBattle.createAiDefinition();
        ai.fromFile('crawler');
        this._simulation.addTank(ai);
      }

      this._simulation.start();
      this._isRunning = true;
    })
  }

}
