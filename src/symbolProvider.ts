import * as vscode from 'vscode';

export class SymbolProvider implements vscode.DocumentSymbolProvider {
  private format(tokens: string[]): string {
    const name = [];

    for (let j = 0; j < tokens.length; j++) {
      const element = tokens[j];
      if (
        element.startsWith('*') ||
        element === ';#region' ||
        element === ';#endregion'
      ) {
        continue;
      }
      name.push(element);
    }
    return name.join(' ');
  }

  provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentSymbol[]> {
    return new Promise((resolve, reject) => {
      const symbols: vscode.DocumentSymbol[] = [];
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);

        // line can start or end with ;#region
        if (line.text.includes(';#region')) {
          const symbol = new vscode.DocumentSymbol(
            this.format(line.text.split(' ')),
            'Region',
            vscode.SymbolKind.String,
            line.range,
            line.range
          );
          symbols.push(symbol);
        }
      }
      resolve(symbols);
    });
  }
}
