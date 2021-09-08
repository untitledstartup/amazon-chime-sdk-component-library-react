// Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React, { ReactNode, useEffect, useState } from 'react';

import { ControlBarButton } from '../../ui/ControlBar/ControlBarButton';
import { Camera, Spinner } from '../../ui/icons';
import { useVideoInputs } from '../../../providers/DevicesProvider';
import { useLocalVideo } from '../../../providers/LocalVideoProvider';
import { useVideoProcessor } from '../../../providers/VideoProcessingProvider';
import { DeviceConfig } from '../../../types';
import { getDeviceID, isOptionActive, videoInputSelectionToDevice } from '../../../utils/device-utils';
import PopOverItem from '../../ui/PopOver/PopOverItem';
import useSelectVideoInputDevice from '../../../hooks/sdk/useSelectVideoInputDevice';
import { Device, isVideoTransformDevice, VideoTransformDevice } from 'amazon-chime-sdk-js';
import { useMeetingManager } from '../../../providers/MeetingProvider';
import PopOverSeparator from '../../ui/PopOver/PopOverSeparator';

interface Props {
  /** The label that will be shown for video input control, it defaults to `Video`. */
  label?: string;
  videoFilterOnLabel?: string;
  videoFilterOffLabel?: string;
}

const videoInputConfig: DeviceConfig = {
  additionalDevices: true,
};

const VideoInputControl: React.FC<Props> = ({ label = 'Video', videoFilterOffLabel ='Enable Circular Cut Filter', videoFilterOnLabel = 'Circular Cut Filter Enabled' }) => {
  const meetingManager = useMeetingManager();
  const { devices, selectedDevice } = useVideoInputs(videoInputConfig);
  const { isVideoEnabled, toggleVideo } = useLocalVideo();
  const selectDevice = useSelectVideoInputDevice();

  const { addVideoProcessor } = useVideoProcessor();
  const [isVideoFilterOn, setIsVideoFilterOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVideoFilterEnabled, setIsVideoFilterEnabled] = useState(false);
  const [dropdownWithVideoFilterOptions, setDropdownWithVideoFilterOptions] = useState<ReactNode[] | null>(null);
  const [device, setDevice] = useState<Device | VideoTransformDevice | null>(meetingManager.selectedVideoInputTransformDevice);

  useEffect(() => {
    meetingManager.subscribeToSelectedVideoInputTransformDevice(setDevice);
    return (): void => {
      meetingManager.unsubscribeFromSelectedVideoInputTranformDevice(setDevice);
    };
  }, []);

  useEffect(() => {
    console.log(`Device changed - ${JSON.stringify(device)} is a video transform device: ${isVideoTransformDevice(device)}`);
    if (isVideoTransformDevice(device)) {
      console.log(`Setting Video Filter Enabled to true`);
      setIsVideoFilterEnabled(true);
    } else {
      console.log(`Setting Video Filter Enabled to false`);
      setIsVideoFilterEnabled(false);
    }
  }, [device]);

  
  useEffect(() => {
    let dropDownOptions = [];
    console.log(`Something changed - rerender the video input list`);
    const deviceOptions: ReactNode[] = devices.map((device) => (
      <PopOverItem
        key={device.deviceId}
        children= {<span>{device.label}</span>}
        checked= {isOptionActive(selectedDevice, device.deviceId)}
        onClick= {async() => {
          // Depending on if a video filter is applied, use the video processor on the next video input selected
          if (device.deviceId === 'none') {
            selectDevice('none');
          } else if (isVideoFilterEnabled) {
              const currentDevice = videoInputSelectionToDevice(device.deviceId);
              const current = await addVideoProcessor(currentDevice);
              await meetingManager.selectVideoInputDevice(current);
          } else {
            selectDevice(device.deviceId);
          }
        }}
      />
    ));
  
    // TODO: Need to add multiple filters eventually
    const videoFilterOptions: ReactNode = 
    <PopOverItem
      key='videoinput'
      children = {
        <>
          {isLoading && <Spinner width="1.5rem" height="1.5rem" />}
          {isVideoFilterEnabled ? videoFilterOnLabel : videoFilterOffLabel}
        </>}
      checked={isVideoFilterEnabled}
      disabled= {isLoading}
      onClick={() => {
        setIsLoading(true);
        setIsVideoFilterOn(current => !current);
      }}
    />;

    dropDownOptions.push(deviceOptions);
    dropDownOptions?.push(<PopOverSeparator key = 'separator' />);
    dropDownOptions.push(videoFilterOptions);

    setDropdownWithVideoFilterOptions(dropDownOptions);
  }, [
    addVideoProcessor,
    device,
    devices.length,
    isVideoFilterEnabled,
    isVideoFilterOn,
    isLoading,
    selectedDevice,
  ]);

  useEffect(() => {
    async function onVideoFilterCheckboxChange() {
      console.log(`VideoFilter Checkbox On changed to: ${isVideoFilterOn}`);
      let current = device;
      if (isVideoFilterOn) {
        // create a video transform device and select it
        if (!isVideoTransformDevice(device)) {
          if (typeof device === 'string'){
            const currentDevice = videoInputSelectionToDevice(device);
            current = await addVideoProcessor(currentDevice);
          } else {
            current = await addVideoProcessor(device);
          }
          console.log("Video filter is on - selecting video transform device: " + JSON.stringify(current));
        } else {
          console.log("Video Filter is already on");
        }
      } else {
        // switch back to the inner device
        if (isVideoTransformDevice(device)) {
          current = await device.intrinsicDevice();
          console.log("Video filter is off - selecting device: " + JSON.stringify(current));
        } else {
          console.log("Video Filter is already off");
        }
      }
      console.log(`Selecting ${JSON.stringify(current)}`);
      await meetingManager.selectVideoInputDevice(current);
      setIsLoading(false);
    }

    onVideoFilterCheckboxChange();
  }, [isVideoFilterOn]);


  return (
    <ControlBarButton
      icon={<Camera disabled={!isVideoEnabled} />}
      onClick={toggleVideo}
      label={label}
      children={dropdownWithVideoFilterOptions}
    />
  );
};

export default VideoInputControl;
