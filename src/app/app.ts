import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { GameComponent } from './components/game/game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [GameComponent],
  template: `<app-game></app-game>`,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class App {
  title = 'jungle-snake';

  constructor() {
    const doc = inject(DOCUMENT);
    // Load Google Fonts at runtime so Angular build tool never inlines them
    const fontUrl = ['https://fonts', '.googleapis.com/css2?family=Cinzel',
      ':wght@700;900&family=Exo+2:wght@400;700&display=swap'].join('');
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontUrl;
    doc.head.appendChild(link);
  }
}
