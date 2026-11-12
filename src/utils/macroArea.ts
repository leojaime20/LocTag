export function normalizeMacroArea(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function macroAreaKey(value: string | undefined): string {
  return normalizeMacroArea(value).toLocaleLowerCase('pt-BR');
}
