declare module "cc-langs" {
  interface Lang {
    getPluralN: (n: number) => number;
    messages: { [key: string]: string | string[] };
  }
  const langs: { [key: string]: Lang };
  export default langs;
}
