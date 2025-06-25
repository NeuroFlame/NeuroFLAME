export function terminalOutput(output: any, setOutput: any) {
  window.ElectronAPI.terminalOutput((event: any, data: string) => {
    if (data) {
      // Use a functional update to append new data to the existing output
      setOutput((prevOutput: any) => {
        // Append the new data to the previous output (array)
        return [...prevOutput, data];
      });
    }
  });
}