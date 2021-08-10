// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useContext,
  createContext,
  useCallback,
} from 'react';
import {
  Device,
  VoiceFocusTransformDevice,
  VoiceFocusDeviceTransformer,
  VoiceFocusSpec,
  VoiceFocusDeviceOptions,
} from 'amazon-chime-sdk-js';

import useMemoCompare from '../../utils/use-memo-compare';

interface Props {
  /** Determines how you want Amazon Voice Focus to behave. This spec is used to derive a runtime configuration when a transformer is created. */
  spec?: VoiceFocusSpec;
  /**
  * A set of options that can be supplied when creating an Amazon Voice Focus device.
  * For more info, you can go to https://aws.github.io/amazon-chime-sdk-js/interfaces/voicefocusdeviceoptions.html
  */
  options?: VoiceFocusDeviceOptions;
}

interface VoiceFocusState {
  isVoiceFocusSupported: boolean | undefined;
  addVoiceFocus: (device: Device) => Promise<Device | VoiceFocusTransformDevice>;
}

const VoiceFocusContext = createContext<VoiceFocusState | null>(null);

const VoiceFocusProvider: React.FC<Props> = ({
  spec,
  options,
  children
}) => {
  const [isVoiceFocusSupported, setIsVoiceFocusSupported] = useState<boolean | undefined>(undefined);
  const [voiceFocusDevice, setVoiceFocusDevice] = useState<VoiceFocusTransformDevice | null>(null);
  const [voiceFocusTransformer, setVoiceFocusTransformer] = useState<VoiceFocusDeviceTransformer | null>(null);

  // Check whether the value of spec is undefined or empty object
  const vfSpec = useMemoCompare(spec, (prev: VoiceFocusSpec | undefined, next: VoiceFocusSpec | undefined): boolean => {
    if (prev === next) {
      return true;
    }
    if (prev && next && Object.keys(prev).length === 0 && Object.keys(next).length === 0) {
      return true;
    }
    return false;
  });

  const addVoiceFocus = async (device: Device): Promise<Device | VoiceFocusTransformDevice> => {
    if (!voiceFocusDevice) {
      return createVoiceFocusDevice(device);
    }
    const vf = await voiceFocusDevice.chooseNewInnerDevice(device);
    setVoiceFocusDevice(vf);
    return vf;
  };

  async function createVoiceFocusDevice(inner: Device): Promise<Device | VoiceFocusTransformDevice> {
    if (!isVoiceFocusSupported) {
      return inner;
    }
    try {
      const transformer = await getVoiceFocusDeviceTransformer(spec, options);
      const device = await transformer?.createTransformDevice(inner);
      if (device) {
        setVoiceFocusDevice(device);
        return device;
      }
    } catch (e) {
      console.warn('Amazon Voice Focus is not supported.', e);
    }
    return inner;
  }

  let currentPromise: Promise<VoiceFocusDeviceTransformer>;

  /**
  * We use currentPromise to store the latest promise of VoiceFocusDeviceTransformer.
  * If the builder changes the spec or options when the previous promise is still pending,
  * We will just grab the latest settings to create an Amazon Voice Focus transformer.
  * This function will always return the most recent promise.
  */
  async function getVoiceFocusDeviceTransformer(spec: VoiceFocusSpec | undefined,
    options: VoiceFocusDeviceOptions | undefined): Promise<VoiceFocusDeviceTransformer> {
    if (voiceFocusTransformer) {
      return voiceFocusTransformer;
    }

    const fetch = VoiceFocusDeviceTransformer.create(spec, options);
    fetch.then((value) => {
      if (fetch === currentPromise) {
        setVoiceFocusTransformer(value);
      }
    });
    currentPromise = fetch;
    return currentPromise;
  }

  // Just for testing, will remove it later
  (window as unknown as any).changeSpec = async (obj: any) => {
    const fetch = getVoiceFocusDeviceTransformer(obj, options);
    const transformer = await fetch;
    console.log('____________________');
    console.log('the current promise', fetch);
    console.log('the current transformer', transformer);
  }

  useEffect(() => {
    async function initVoiceFocus() {
      try {
        const transformer = await getVoiceFocusDeviceTransformer(vfSpec, options);
        if (transformer && transformer.isSupported()) {
          setIsVoiceFocusSupported(true);
          return;
        }
      } catch (e) {
        console.warn('Amazon Voice Focus is not supported.', e);
      }
      setIsVoiceFocusSupported(false);
    };
    initVoiceFocus();
  }, [vfSpec, options]);

  useEffect(() => {
    if (isVoiceFocusSupported === undefined) {
      return;
    }

    if (isVoiceFocusSupported) {
      console.log('Amazon Voice Focus is supported.');
    } else {
      console.warn('Amazon Voice Focus is not supported.');
    }
  }, [isVoiceFocusSupported]);

  const value: VoiceFocusState = useMemo(
    () => ({
      isVoiceFocusSupported,
      addVoiceFocus,
    }),
    [isVoiceFocusSupported, addVoiceFocus]
  );

  return (
    <VoiceFocusContext.Provider value={value}>
      {children}
    </VoiceFocusContext.Provider>
  );
}

const useVoiceFocus = (): VoiceFocusState => {
  const context = useContext(VoiceFocusContext);

  if (!context) {
    throw new Error(
      'useVoiceFocus must be used within VoiceFocusProvider'
    );
  }
  return context;
}


export { VoiceFocusProvider, useVoiceFocus };


