// Monitoring role map adapted from Devore D80-Panel (MIT, LICENSE-UPSTREAM).
import { observeProperty } from 'aes70';
function normalize(value) {
 if(value && typeof value.item === 'function' && Array.isArray(value.values)) value=value.item(0);
 return value?.isEnum ? value.name : value;
}
export function watchAmp({roles,channelCount,amp,serial,states,controller,broadcast}) {
 const cleanups=[];
      const watch = (roleName, target, key, prop = 'Reading') => {
        const obj = roles.get(roleName);
        if (!obj) return;
        try {
          cleanups.push(observeProperty(obj, prop, (ok, value) => {
            if (!ok || controller.signal.aborted || states.get(serial) !== amp) return;
            target[key] = normalize(value);
            broadcast();
          }));
        } catch (err) {
          console.warn(`[${amp.deviceName}] cannot observe ${roleName}.${prop}:`, err.message);
        }
      };

      // Same as watch(), but also captures the property's max (e.g. a
      // channel's true rated output power) instead of discarding it — the
      // meters page needs that per-channel ceiling to scale correctly, since
      // it isn't the same across amp models.
      const watchWithMax = (roleName, target, key, maxKey) => {
        const obj = roles.get(roleName);
        if (!obj) return;
        try {
          cleanups.push(observeProperty(obj, 'Reading', (ok, value) => {
            if (!ok || controller.signal.aborted || states.get(serial) !== amp) return;
            if (value && typeof value.item === 'function' && Array.isArray(value.values)) {
              target[key] = normalize(value.item(0));
              target[maxKey] = normalize(value.item(2));
            } else {
              target[key] = normalize(value);
            }
            broadcast();
          }));
        } catch (err) {
          console.warn(`[${amp.deviceName}] cannot observe ${roleName}.Reading:`, err.message);
        }
      };

      watch('Status/Status_DeviceStatus', amp.status, 'deviceStatus', 'Position');
      watch('Status/Status_StatusText', amp.status, 'firmware');
      watch('Status/Status_PwrOk', amp.status, 'pwrOk');
      watch('Status/Status_SmpsTemperature', amp.status, 'smpsTempC');
      watch('Error/Error_GnrlErr', amp.status, 'generalError');
      watch('Error/Error_DeviceErr', amp.status, 'deviceError');
      watch('Error/Error_AmpErr', amp.status, 'ampError');
      watch('Error/Error_SmpsErr', amp.status, 'smpsError');
      watch('Error/Error_ErrorText', amp.status, 'errorText');

      for (let i = 1; i <= channelCount; i++) {
        const ch = amp.channels[i - 1];
        watch(`Config/Config_Mute${i}`, ch, 'muted', 'State');
        watch(`Config/Config_PotiLevel${i}`, ch, 'gainDb', 'Gain');
        watch(`Config/Config_ChannelName${i}`, ch, 'name', 'Setting');

        watch(`ChStatus/ChStatus_Isp${i}`, ch, 'isp');
        watch(`ChStatus/ChStatus_Osp${i}`, ch, 'osp');
        watch(`ChStatus/ChStatus_AmpOn${i}`, ch, 'ampOn');
        watch(`ChStatus/ChStatus_Ovl${i}`, ch, 'overload');
        watch(`ChStatus/ChStatus_InputOverload${i}`, ch, 'inputOverload');
        watch(`ChStatus/ChStatus_OutputOverload${i}`, ch, 'outputOverload');
        watch(`ChStatus/ChStatus_Gr${i}`, ch, 'limiting');
        watch(`ChStatus/ChStatus_GrHead${i}`, ch, 'headroomDb');
        watch(`ChStatus/ChStatus_InputVoltage${i}`, ch, 'inputLevelDbu');
        watchWithMax(`ChStatus/ChStatus_OutputPower${i}`, ch, 'outputPowerW', 'outputPowerMaxW');
        watch(`ChStatus/ChStatus_SpeakerImpedance${i}`, ch, 'impedanceOhm');
        watch(`ChStatus/ChStatus_AmpTemperature${i}`, ch, 'tempC');
        watch(`ChStatus/ChStatus_StatusText${i}`, ch, 'statusText');
      }


 return () => {for(const stop of cleanups)try{stop();}catch{}};
}
