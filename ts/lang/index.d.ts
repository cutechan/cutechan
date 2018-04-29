interface Lang {
  getPluralN: (n: number) => number;
  messages: { [key: string]: string | string[] };
}

declare module "cc-langs" {
  const langs: { [key: string]: Lang };
  export default langs;
}
