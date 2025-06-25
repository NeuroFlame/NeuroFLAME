import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { electronApi } from "../../../apis/electronApi/electronApi";
import ScrollToBottom from 'react-scroll-to-bottom';
import { Box, Button, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const ScrollToBottomWrapper = forwardRef<HTMLDivElement, React.ComponentProps<typeof ScrollToBottom>>(
  (props, ref) => {
    return <ScrollToBottom {...props} />;
  }
);

const TerminalWindow: React.FC<{command:string}> = ({command}) => {
  // State to store terminal input and output
  // const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [isTerminalReady, setTerminalReady] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [imageExists, setImageExists] = useState(false);

  const { spawnTerminal, terminalInput, terminalOutput, removeTerminalOutputListener } = electronApi;
  
  // Refs to interact with the DOM elements
  const terminalRef = useRef<HTMLDivElement | null>(null); 
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Request Electron to spawn a new terminal (IPC call to spawn terminal)
    if(!isTerminalReady){
      spawnTerminal(setTerminalReady);
    }
    terminalOutput(output, setOutput);
    checkIfImageDownloaded();
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    return () => {
      // Cleanup the listener when the component is unmounted or the terminal is closed
      removeTerminalOutputListener();
    };
  }, []);

  useEffect(() => {
    Array.from(new Set(output)).map((item, index) => (
      testOutputForImage(item)
    ));
  }, [output])

  const testOutputForImage = (str:string) => {
    if(str.includes('"Id": "sha256:') || str.includes('Status: Downloaded newer image for')){
      setImageExists(true);
    } else {
      setImageExists(false);
    }
  }

  const checkIfImageDownloaded = () => {
    const imageName = command.replace('docker pull ','');
    terminalInput('docker image inspect '+imageName);
  };

  const handleButtonPress = (input:string) => {
      terminalInput(input);
      terminalOutput(output, setOutput);
      setShowTerminal(true);
  }; 

  return (
    <>
      {!imageExists && !showTerminal &&
      <Button 
        variant='contained' 
        size='small'
        onClick={() => handleButtonPress(command)}
        style={{backgroundColor: '#0066FF'}}
      >
        Run Docker Pull
      </Button>}
      {showTerminal && <ScrollToBottomWrapper ref={terminalRef} className="terminalWindow">
        {Array.from(new Set(output)).map((item, index) => (
          <div key={index} style={{whiteSpace: 'nowrap'}}>&gt; {item}</div>
        ))}
      </ScrollToBottomWrapper>}
      <Box display='flex' justifyContent='space-between' alignContent='center'>
      {imageExists && <Box display='flex' justifyContent='flex-start' alignContent='center'>
        <CheckCircleIcon sx={{color: '#2FB600'}} />
        <Typography style={{fontSize: '0.8rem', lineHeight: '2', marginLeft: '0.25rem'}}>Docker Image Downloaded</Typography>
      </Box>}
      {showTerminal && <Button size='small' onClick={() => setShowTerminal(false)}>Hide Terminal</Button>}
      </Box>
  </>
  );
};

export default TerminalWindow;
