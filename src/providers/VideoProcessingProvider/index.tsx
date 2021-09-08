// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React, {
    useState,
    // useEffect,
    useContext,
    createContext,
  } from 'react';
  
  import {
    Device,
    VideoTransformDevice,
    isVideoTransformDevice,
    DefaultVideoTransformDevice,
    ConsoleLogger,
    LogLevel,
  } from 'amazon-chime-sdk-js';

  import CircularCut from '../../videofilter/CircularCut';
  import CWTSegmentationProcessor from '../../videofilter/CWTSegmentationProcessor';

  
  interface Props {
    // options?: ;
  }
  
  interface VideoProcessingState {
    addVideoProcessor: (device: Device) => Promise<Device | VideoTransformDevice>;
  }
  
  const VideoProcessingContext = createContext<VideoProcessingState | null>(null);
  
  const VideoProcessingProvider: React.FC<Props> = ({
    // options,
    children
  }) => {
    const [videoTransformDevice, setVideoTransformDevice] = useState<VideoTransformDevice | null>(null);

    const addVideoProcessor = async (device: Device): Promise<Device | VideoTransformDevice> => {
      console.log("Adding VideoProcessingDevice" + device?.toString());
      if (isVideoTransformDevice(device)){
          setVideoTransformDevice(device);
          return device;
      }
      try {
        // TODO: Need to add logic to add these one at a time - for demo's sake, this is how to apply multiple processors
        const processor = new CWTSegmentationProcessor();
        const processor2 = new CircularCut();
        const logger = new ConsoleLogger('string', LogLevel.INFO);
        const chosenVideoTransformDevice = new DefaultVideoTransformDevice(logger, device, [processor, processor2]);
        setVideoTransformDevice(chosenVideoTransformDevice);
        return chosenVideoTransformDevice;
      } catch (e) {
        console.warn('Failed to create a DefaultVideoTransformDevice', e);
      }
      return device;
    };
  
    const value: VideoProcessingState = {
        addVideoProcessor
    }
  
    return (
      <VideoProcessingContext.Provider value={value}>
        {children}
      </VideoProcessingContext.Provider>
    );
  }
  


  const useVideoProcessor = (): VideoProcessingState => {
    const context = useContext(VideoProcessingContext);
  
    if (!context) {
      throw new Error(
        'useVideoProcessor must be used within VideoProcessingProvider'
      );
    }
    return context;
  }
  
  export { VideoProcessingProvider, useVideoProcessor };
  