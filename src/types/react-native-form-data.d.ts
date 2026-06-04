export {};

declare global {
  interface ReactNativeFormDataFile {
    name: string;
    type: string;
    uri: string;
  }

  interface FormData {
    append(
      name: string,
      value: Blob | ReactNativeFormDataFile | string,
      fileName?: string
    ): void;
  }
}
