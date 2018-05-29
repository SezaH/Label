
![Waste Busters](./header.png)

[![Build Status](https://travis-ci.org/ecs-193/label.svg?branch=master)](https://travis-ci.org/ecs-193/label)

# Label

Sorts trash using vision and machine learning.

# Getting Started
You'll need Node 8.9.3 and Git installed.
```
git clone https://github.com/ecs-193/label.git
cd label
npm install
npm start
```

# Introduction

# Technologies
- [Node](https://nodejs.org/en/about/): a JavaScript runtime built on Chrome's V8 JavaScript engine
- [Electron](https://electron.atom.io/): a framework built on Node and Chromium for creating cross-platform native applications
- [TypeScript](https://www.typescriptlang.org/): a typed superset of JavaScript that compiles to plain JavaScript
- [Tfrecord](https://github.com/pwnall/tfrecord): a small JS library for creating TF record files

# Contributing

`dev` is the main development branch of the project. `master` is a protected branch that prevents direct pushing. `master` is reserved for commits that have passed automated testing. In order to merge into `master` you must first push a new branch with your changes to GitHub and submit a Pull Request (PR). If the tests pass, another member will review your code and approve the PR for merging.

### Code Formatting

Keeping a consistent code format is important and reduces the occurrences of merge conflicts.
To keep a consistent style on all platforms we are using [TSLint](https://palantir.github.io/tslint/).

`npm run lint` to lint the project.

`npm run format` to lint and automatically fix most format errors.

It is suggested to add this to the pre-commit hook.

**Always format your code before committing**

### Sample workflow for making new features/changes:
  1. Checkout `dev` and pull the latest changes from GitHub
     - `git checkout dev`
     - `git pull --ff-only`
  2. Make a new branch for your changes (all lowercase with hyphens separating words)
     - `git checkout -b <branch-name>`
  3. Push your branch to GitHub
     - `git push -u origin <branch-name>` - `-u` is to set `origin <branch-name>` as default upstream destination 
  4. Make your changes and commits (There are many commands/options to accomplish this, these are just a few)
     - See what changes you made:
       - `git status`  - Shows the modified files
       - `git diff [<file-name>]` - Shows the modified lines
     - Stage the changes (Choose what changes will be part of the commit)
       - `git add <file-name>` - Add a specific file or pattern
       - `git add -p` - Interactively choose chunks of code to add (My favorite)
       - `git add .` - Add all changes (Use sparingly)
     - Make the commit
       - `git commit -m "<commit-message>"` - When the commit message is short
       - `git commit` - Will open a text editor to enter longer commit messages
  5. Get any new changes from `dev` (Do this throughout the development of your feature as well!)
     - `git pull -r origin dev` - `-r` is for rebasing so a linear history is maintained. Don't forget it!
  6. Push your branch to GitHub (Do this often too)
     - `git push`
  7. Repeat steps 4, 5 and 6 until your feature is complete 
  8. Make a new Pull Request on GitHub
     - New Pull Request  (base: `dev` <- compare: `<branch-name>`)
     - Add `closes#<issue-number>` to the description
     - Fill in detail description of additions, changes, and removals
     - Request a reviewer

Please try to follow this [Style Guide](https://github.com/agis/git-style-guide#table-of-contents) when using Git.

# Structure

### `maint.ts`

The entry point of the main Electron thread. See [here](https://github.com/electron/electron/blob/master/docs/tutorial/first-app.md#electron-development-in-a-nutshell) for more information.

### `renderer.ts`

- Handles all the GUI interactions.
- Binds actions to buttons
- Handles labeling images
- Loads and displays images
- Saves the labeled images to disk

### `index.html`

- Defines the GUI (What the user sees)

### `style.css`

- Applies styling to the user interface

### `records.ts`

- Handles converting the labeled data into the correct format to be trained with

### `capture.ts`

- Handles capturing the images when collecting new data
- Allows for automatic or manual collection

### `capture.html`

- The GUI for capturing images