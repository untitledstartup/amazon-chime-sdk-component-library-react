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
  import { useMeetingManager } from '../MeetingProvider';

  import CircularCut from '../../videofilter/CircularCut'
  
  interface Props {
    // options?: ;
  }
  
  interface VideoProcessingState {
    addVideoProcessor: (device: Device) => Promise<Device | VideoTransformDevice>;
    // isVideoTransformDevice: (device: Device) => boolean | undefined;
  }
  
  const VideoProcessingContext = createContext<VideoProcessingState | null>(null);
  
  const VideoProcessingProvider: React.FC<Props> = ({
    // options,
    children
  }) => {
    const [videoTransformDevice, setVideoTransformDevice] = useState<VideoTransformDevice | null>(null);
    const meetingManager = useMeetingManager();
  
    const addVideoProcessor = async (device: Device): Promise<Device | VideoTransformDevice> => {
      console.log("Adding VideoProcessingDevice" + device?.toString());
      if (isVideoTransformDevice(device)){
          setVideoTransformDevice(device);
          return device;
      }
      try {
        const processor = new CircularCut();
        // TODO: Change this
        const logger = new ConsoleLogger('string', LogLevel.INFO);
        const chosenVideoTransformDevice = new DefaultVideoTransformDevice(logger, device, [processor]);
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
  