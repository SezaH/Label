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

}
