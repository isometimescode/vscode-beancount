'use strict';
import * as vscode from 'vscode';
import {Range, Position} from 'vscode';

export class Formatter {
  instantFormat(e: vscode.TextDocumentChangeEvent) {
    if (vscode.window.activeTextEditor === undefined ||
      e.document.languageId !== 'beancount') {
      return;
    }
    if (e.contentChanges.length === 0) {
      // protect against empty contentChanges arrays...
      return;
    }
    const text = e.contentChanges[0].text;
    const rangeLength = e.contentChanges[0].rangeLength;
    const line = e.contentChanges[0].range.start.line;
    if (
      text === '.' &&
      rangeLength === 0 &&
      vscode.workspace.getConfiguration('beancount')['instantAlignment']
    ) {
      // the user just inserted a new decimal point
      this.alignSingleLine(line);
    }
    if (text === '\n' && rangeLength === 0) {
      // the user just inserted a new line
      const lineText = vscode.window.activeTextEditor.document.lineAt(line)
          .text;
      const transRegex = /([0-9]{4})([\-|/])([0-9]{2})([\-|/])([0-9]{2}) (\*|\!)/;
      const transArray = transRegex.exec(lineText);
      if (transArray != null) {
        // the user inserted a new line under a transaction
        const r = new Range(
            new Position(line + 1, 0),
            new Position(line + 1, 0),
        );
        const tabSize = vscode.window.activeTextEditor.options
            .tabSize as number;
        const edit = new vscode.TextEdit(r, ' '.repeat(tabSize));
        const wEdit = new vscode.WorkspaceEdit();
        wEdit.set(vscode.window.activeTextEditor.document.uri, [edit]);
        vscode.workspace.applyEdit(wEdit); // insert spaces for a new posting line
      }
    }
  }

  alignSingleLine(line: number) {
    if (vscode.window.activeTextEditor === undefined) {
      return;
    }
    const activeEditor = vscode.window.activeTextEditor;
    const originalText = activeEditor.document.lineAt(line).text;
    // save the original text length and cursor position
    const originalCursorPosition = activeEditor.selection.active;
    const originalLength = originalText.length;
    // find an account name first
    const accountRegex = /([A-Z][A-Za-z0-9\-]+)(:)/;
    const accountArray = accountRegex.exec(originalText);
    if (accountArray === null) {
      return;
    } // A commodity record always starts with an account.
    // find a number with a decimal point
    const amountRegex = /([\-|\+]?)(?:\d|\d[\d,]*\d)(\.)/;
    const amountArray = amountRegex.exec(originalText);
    if (amountArray === null) {
      return;
    }
    const contentBefore = ('s' + originalText.substring(0, amountArray.index))
        .trim()
        .substring(1);
    let contentAfterAmount = '';
    if (amountArray.index + amountArray[0].length < originalText.length) {
      // get all the contents after the decimal point
      contentAfterAmount = originalText.substring(
          amountArray.index + amountArray[0].length,
      );
    }
    const targetDotPosition =
      vscode.workspace.getConfiguration('beancount')['separatorColumn'] - 1;
    const contentBeforeLength =
      vscode.workspace.getConfiguration('beancount')['fixedCJKWidth'] ?
      this.getFixedDisplayWidth(contentBefore) : contentBefore.length;
    const whiteLength =
      targetDotPosition - contentBeforeLength - (amountArray[0].length - 1);
    if (whiteLength > 0) {
      const newText =
        contentBefore +
        new Array(whiteLength + 1).join(' ') +
        amountArray[0] +
        contentAfterAmount;
      const r = new vscode.Range(
          new vscode.Position(line, 0),
          new vscode.Position(line, originalText.length),
      );
      const edit = new vscode.TextEdit(r, newText);
      const wEdit = new vscode.WorkspaceEdit();
      wEdit.set(activeEditor.document.uri, [edit]);
      vscode.workspace.applyEdit(wEdit).then((value) => {
        if (value && line === originalCursorPosition.line) {
          const newPositionChar =
            1 +
            originalCursorPosition.character +
            newText.length -
            originalLength;
          activeEditor.selection = new vscode.Selection(
              line,
              newPositionChar,
              line,
              newPositionChar,
          );
        }
      });
    }
  }

  getFixedDisplayWidth(string: String) {
    // The ranges of CJK aka East Asian characters
    // which take up one "Em" of space in fixed pitched fonts.
    // http://www.unicode.org/reports/tr11-2/
    const WideChars = [
      // Classifications: W - Wide
      '\u1100-\u11F9',
      '\u3000-\u303F',
      '\u3041-\u3094',
      '\u3099-\u309E',
      '\u30A1-\u30FE',
      '\u3131-\u318E',
      '\u3190-\u319F',
      '\u3200-\u321C',
      '\u3220-\u3243',
      '\u3260-\u32B0',
      '\u32C0-\u3376',
      '\u337B-\u33DD',
      '\u33E0-\u33FE',
      '\u4E00-\u9FA5',
      '\uAC00-\uD7A3',
      '\uE000-\uE757',
      '\uF900-\uFA2D',
      // Classifications: F - FullWidth
      '\uFE30-\uFE44',
      '\uFE49-\uFE52',
      '\uFE54-\uFE6B',
      '\uFF01-\uFF5E',
      '\uFFE0-\uFFE6',
    ];
    const charsRegex = new RegExp(`[${WideChars.join('')}]`, 'g');
    return string.replace(charsRegex, '..').length;
  }
}
