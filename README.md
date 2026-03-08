# 🐍 Jungle Serpent — Snake Adventure Game

A fully animated, immersive Snake game built with **Angular + Canvas API + SCSS**. Navigate your snake through a lush, dangerous jungle — eat animals to grow, dodge hunters, and reach the victory flag!

## 🎮 How to Play

| Key | Action |
|-----|--------|
| `W` / `↑` | Move Up |
| `S` / `↓` | Move Down |
| `A` / `←` | Move Left |
| `D` / `→` | Move Right |
| `P` / `Esc` | Pause / Resume |

### 🏆 Objectives
- **Eat prey animals** to grow your snake and score points
- **Avoid hunters** — they patrol the jungle with sight cones  
- **Reach the green flag** on the right side of the jungle to WIN!

## 🛠️ Run Locally

```bash
npm install
npx ng serve
# Open: http://localhost:4200
```

## 📦 Production Build

```bash
npx ng build --configuration production
# Deploy dist/jungle-snake/browser/ to any static host
```

## 🎨 Features

- 🌴 Animated jungle world — swaying trees, grass, dappled light, clouds
- 🐍 Detailed snake — blinking eyes, forked tongue, scale patterns
- 👨 Smart AI hunters — patrol paths, sight cones, state machine
- 🦋 Wandering animals — move and bob around the world
- 💥 Particle effects — sparkles, explosions, smoke, leaves
- 🏁 Victory flag with waving animation and glow
- 🏆 High score saved to localStorage
- ⏸ Pause system, smooth camera, full menu/win/death screens

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
