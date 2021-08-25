// Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React, {
  useState,
  useEffect,
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

  // Make sure that minor changes to the spec don't result in recomputation:
  // Any value of `{}` and undefined are all considered the same.
  const vfSpec = useMemoCompare(spec, (prev: VoiceFocusSpec | undefined, next: VoiceFocusSpec | undefined): boolean => {
    if (prev === next) {
      return true;
    }

    // Either prev is undefined and next is the empty object, or
    // next is undefined and prev is the empty object.
    if (prev === undefined && next && Object.keys(next).length === 0) {
      return true;
    }
    if (next === undefined && prev && Object.keys(prev).length === 0) {
      return true;
    }

    // They are a richer objects, and we won't try to compare them.
    return false;
  });

  function logDevice(device: VoiceFocusTransformDevice | null) {
    if (!device) {
      console.info('Device is null.');
    }
    /* @ts-ignore */
    console.info('Device: ', device?.voiceFocus?.nodeOptions?.modelURL);
  }

  console.info('outside');
  logDevice(voiceFocusDevice);
  let now = Date.now();
  const addVoiceFocus = async (device: Device): Promise<Device | VoiceFocusTransformDevice> => {
    console.info('inside', now);
    logDevice(voiceFocusDevice);
    if (voiceFocusDevice) {
      console.info('Choosing new inner device');
      const vf = await voiceFocusDevice.chooseNewInnerDevice(device);
      setVoiceFocusDevice(vf);
      return vf;
    }

    if (!isVoiceFocusSupported) {
      console.info('Not supported, not creating device.');
      return device;
    }

    try {
      const transformer = await getVoiceFocusDeviceTransformer();
      console.info('Got transformer for device', transformer);
      const vf = await transformer?.createTransformDevice(device);
      if (vf) {
        setVoiceFocusDevice(vf);
        return vf;
      }
    } catch (e) {
      console.warn('Amazon Voice Focus is not supported.', e);
    }

    return device;

  };

  (addVoiceFocus as unknown as any).when = Date.now();

  let currentPromise: Promise<VoiceFocusDeviceTransformer | undefined> | undefined;

  /**
  * We use currentPromise to store the latest promise of VoiceFocusDeviceTransformer.
  * If the builder changes the spec or options when the previous promise is still pending,
  * We will just grab the latest settings to create an Amazon Voice Focus transformer.
  * This function will always return the most recent promise.
  */
  async function getVoiceFocusDeviceTransformer(): Promise<VoiceFocusDeviceTransformer | undefined> {
    if (voiceFocusTransformer) {
      console.info('Have a transformer.');
      return voiceFocusTransformer;
    }

    // This should only be hit if `isVoiceFocusSupported` was true at some point,
    // but the transformer is now missing, which means we are updating the transformer.
    console.info('No transformer; waiting for the last creation promise to resolve.');
    return currentPromise;
  }

  async function createVoiceFocusDeviceTransformer(spec: VoiceFocusSpec | undefined, options: VoiceFocusDeviceOptions | undefined, canceled: () => boolean): Promise<VoiceFocusDeviceTransformer> {
    const fetch = VoiceFocusDeviceTransformer.create(spec, options);
    console.info('Creation promise is', fetch);
    fetch.then((transformer) => {
      // A different request arrived afterwards. Drop this one on the floor
      // using the cancelation mechanism of `useEffect`.
      if (canceled()) {
        console.info('xxx discarding due to race', new Error('yyy'));
        return;
      }

      console.info('Got transformer', transformer);
      console.info('Clearing promise');
      currentPromise = undefined;
      try {
        setVoiceFocusTransformer(transformer);
      } catch (e) {
        console.info('Set failed 1!');
      }
      try {
        console.info('Clearing VF device.');
        setVoiceFocusDevice(null);
        console.info('done clear');
      } catch (e) {
        console.info('Set failed 2!');
      }
      setIsVoiceFocusSupported(transformer && transformer.isSupported());
    }).catch(e => {
      if (canceled()) {
        console.info('xxx discarding due to race', new Error('xxx'));
        return;
      }

      console.warn('Amazon Voice Focus is not supported.', e);
      console.info('Clearing promise');
      currentPromise = undefined;
      setVoiceFocusTransformer(null);
      console.info('zzz');
      setVoiceFocusDevice(null);
      setIsVoiceFocusSupported(false);
    });

    console.info('Overwriting promise', currentPromise, 'with', fetch);
    currentPromise = fetch;

    return fetch;
  }

  async function initVoiceFocus(vfSpec: VoiceFocusSpec | undefined, options: VoiceFocusDeviceOptions | undefined, canceled: () => boolean) {
    console.info('Reiniting with', vfSpec, options);

    // Throw away the old one and reinitialize.
    setVoiceFocusTransformer(null);
    setVoiceFocusDevice(null);
    createVoiceFocusDeviceTransformer(vfSpec, options, canceled);
  };

  // Just for testing, will remove it later
  (window as unknown as any).initVoiceFocus = initVoiceFocus;
  (window as unknown as any).getVoiceFocusDeviceTransformer = getVoiceFocusDeviceTransformer;

  useEffect(() => {
    console.info('Props did change', vfSpec, options);
    let canceled = false;
    initVoiceFocus(vfSpec, options, () => canceled);
    return () => {
      canceled = true;
    };
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

  // TODO: restore useMemo?
  const value: VoiceFocusState = {
    isVoiceFocusSupported,
    addVoiceFocus,
  };

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
