import { remote } from 'electron';

export namespace Util {

  export async function getDirectoryName() {
    return new Promise<string>((resolve, reject) => {
      remote.dialog.showOpenDialog({
        properties: ['openDirectory'],
      }, (paths) => resolve((paths === undefined) ? '' : paths[0]));
    });
  }

  export async function getFileName(...filters: Array<{ name: string, extensions: string[] }>) {
    return new Promise<string>((resolve, reject) => {
      remote.dialog.showOpenDialog({
        filters,
        properties: ['openFile'],
      }, (files) => resolve((files === undefined) ? '' : files[0]));
    });
  }

  export function hexToRGB(hex: string, alpha: number) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    if (alpha) {
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    } else {
      return 'rgb(' + r + ', ' + g + ', ' + b + ')';
    }
  }
}
