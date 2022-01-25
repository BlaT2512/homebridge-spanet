/* eslint-disable max-len */
import net = require('net');
import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { SpaNETHomebridgePlatform } from './platform';

////////////////////////
// PLATFORM ACCESSORY //
////////////////////////
export class SpaNETPlatformAccessory {
  private service: Service;

  constructor(
    private readonly platform: SpaNETHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Blake Tourneur')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.deviceId)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.deviceId);

    // Create the service for this accessory
    switch(accessory.context.device.deviceClass) {
      case 'Thermostat': // Heater Cooler
        this.service = this.accessory.getService(this.platform.Service.Thermostat) || this.accessory.addService(this.platform.Service.Thermostat);
        break;
      
      case 'Blower': // Fan
        this.service = this.accessory.getService(this.platform.Service.Fan) || this.accessory.addService(this.platform.Service.Fan);
        break;
      
      case 'Lights': // Lightbulb
        this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
        break;
      
      case 'Lock': // Lock Mechanism
        this.service = this.accessory.getService(this.platform.Service.LockMechanism) || this.accessory.addService(this.platform.Service.LockMechanism);
        break;
      
      default: // Switch
        this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
        break;
    }

    // Set display name for the service, as will be seen in the Home App
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // Register handlers for the characteristics
    switch(accessory.context.device.deviceClass) {
      case 'Thermostat': // Thermostat
        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState) // Whether the heater is currently heating/cooling
          .on('get', this.getCurState.bind(this));
        
        this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState) // Whether the heater should be heating/cooling
          .on('get', this.getTargState.bind(this))
          .on('set', this.setTargState.bind(this));
        
        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature) // Current temperature of the spa
          .on('get', this.getCurTemp.bind(this));
        
        this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature) // Target temperature of the spa
          .on('get', this.getTargTemp.bind(this))
          .on('set', this.setTargTemp.bind(this))
          .setProps({
            minValue: 5,
            maxValue: 41,
            minStep: 0.2,
          });
        
        this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits) // Temperature units of the heater
          .on('get', this.getUnits.bind(this))
          .setProps({
            minValue: 0,
            maxValue: 0,
            minStep: 0,
          });
        break;
      
      case 'Blower': // Fan
        this.service.getCharacteristic(this.platform.Characteristic.On) // Whether the blower is on
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));
        
        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed) // Speed of the blower
          .on('get', this.getFanSpeed.bind(this))
          .on('set', this.setFanSpeed.bind(this))
          .setProps({
            minValue: 1,
            maxValue: 5,
            minStep: 1,
          });
        break;
      
      case 'Lights': // Lightbulb
        this.service.getCharacteristic(this.platform.Characteristic.On) // Whether the lights are on
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.Brightness) // Whether the lights are on
          .on('get', this.getBrightness.bind(this))
          .on('set', this.setBrightness.bind(this))
          .setProps({
            minValue: 1,
            maxValue: 5,
            minStep: 1,
          });
        break;
      
      case 'Lock': // Lock Mechanism
        this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState) // Whether the keypad lock is unlocked/locked
          .on('get', this.getCurLock.bind(this));
        
        this.service.getCharacteristic(this.platform.Characteristic.LockTargetState) // Whether the keypad lock should be unlocked/locked
          .on('get', this.getTargLock.bind(this))
          .onSet(this.setTargLock);
        break;
      
      default: // Switch
        this.service.getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));
        break;
    }
  }

  // you must call the callback function
  // the first argument should be null if there were no errors
  // the second argument should be the value to return

  ////////////////////////
  // FUNCTION - SPADATA //
  ////////////////////////
  spaData() {
    // spaData - Connects to the websocket of the spa and get's data about the status of the spa to be parsed
    // Returns - var data (string)
    return new Promise<string>((resolve) => {
      // Connect to the websocket of the spa and request data
      const client = new net.Socket();
      client.connect(9090, this.accessory.context.spaIp, () => {
        client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
        client.write('RF\n');
      });
      // Wait for the result to be recieved from the spa
      client.on('data', (data) => {
        if (data.toString().split('\r\n')[0] === 'RF:') {
          client.destroy();
          // Return the RF data
          resolve(data.toString());
        }
      });
    });
  }

  //////////////////////
  // FUNCTION - GETON //
  //////////////////////
  async getOn(callback: CharacteristicGetCallback) {
    // getOn - Check whether the switch or device is on/active
    // Returns - const isOn (boolean)

    // Call function to get latest data from spa
    const data = await this.spaData();
    // Parse the data and check whether the accessory in question is on or off
    let isOn: boolean;
    switch(this.accessory.context.device.deviceClass){
      case 'Blower': {
        isOn = data.split('\r\n')[4].split(',')[8] as unknown as boolean; // Will only be a '0' or '1'
        break;
      }
      case 'Lights': {
        isOn = data.split('\r\n')[4].split(',')[15] as unknown as boolean; // Will only be a '0' or '1'
        break;
      }
      case 'ModeSwitch': {
        const operMode = data.split('\r\n')[3].split(',')[2];
        const operSwitch = this.accessory.displayName.slice(0, 4).toUpperCase();
        if (operMode === operSwitch){
          isOn = true; 
        } else {
          isOn = false; 
        }
        break;
      }
      case 'PowerSwitch': {
        const powerMode = data.split('\r\n')[5].split(',')[11];
        if (powerMode === this.accessory.context.spaCommand){
          isOn = true;
        } else {
          isOn = false;
        }
        break;
      }
      default: {
        if (this.accessory.displayName === 'Clean'){
          const state = data.split('\r\n')[2].split(',')[24];
          if (state === 'W.CLN'){
            isOn = true;
          } else {
            isOn = false;
          }
        } else {
          const state = data.split('\r\n')[this.accessory.context.spaReadLine].split(',')[this.accessory.context.spaReadBit];
          if (state === this.accessory.context.spaReadOff){
            isOn = false;
          } else {
            isOn = true;
          }
        }
        break;
      }
    }

    this.platform.log.debug('Get Characteristic On ->', isOn);
    callback(null, isOn);
  }

  //////////////////////
  // FUNCTION - SETON //
  //////////////////////
  async setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // setOn - Sets the switch or device's on/active state
    // Input - value as boolean (boolean)
    
    // Connect to websocket to change device state, depending on accessory
    const data = await this.spaData();
    const client = new net.Socket();
    try {
      client.connect(9090, this.accessory.context.spaIp, () => {

        try {
          client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
          
          // Switch for accessory type to send correct command
          switch(this.accessory.context.device.deviceClass){
            case 'Blower': {
              const valueInt = value as number;
              client.write('S28:' + valueInt + '\n');
              break;
            }
            case 'Lights': {
              if (data.split('\r\n')[4].split(',')[15] as unknown as boolean !== value as boolean){
                client.write('W14\n');
              }
              break;
            }
            case 'ModeSwitch': {
              if (value as boolean){
                client.write('W66:' + this.accessory.context.spaCommand + '\n');
              }
              break;
            }
            case 'PowerSwitch': {
              if (value as boolean){
                client.write('W63:' + this.accessory.context.spaCommand + '\n');
              }
              break;
            }
            default: {
              if (this.accessory.displayName === 'Clean'){
                const state = data.split('\r\n')[2].split(',')[24];
                const valueBool = value as boolean;
                if (state === 'W.CLN' && !valueBool){
                  client.write('W12\n');
                }
                if (state !== 'W.CLN' && valueBool){
                  client.write('W12\n');
                }
              } else {
                let valueInt = value as number;
                if (this.accessory.displayName === 'Sleep'){
                  if (value){
                    valueInt = 96;
                  } else {
                    valueInt = 128;
                  }
                }
                client.write(this.accessory.context.spaCommand + valueInt + '\n');
              }
              break;
            }
          }

        } catch {
          this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
          this.platform.log.warn('Failed to set characteristic for spa device');
          client.destroy();
          callback(null);
        }

      });
    } catch {
      this.platform.log.error('Error: The websocket connection to the spa failed. Please check your network connection and that the spa is online by trying to connect in the official SpaLINK app.');
      this.platform.log.warn('Failed to set characteristic for spa device ->', value);
      client.destroy();
      callback(null);
    }

    this.platform.log.debug('Set Characteristic On ->', value);
    callback(null);
  }

  ////////////////////////////
  // FUNCTION - GETCURSTATE //
  ////////////////////////////
  async getCurState(callback: CharacteristicGetCallback) {
    // getCurState - Check whether the heater is off, heating or cooling
    // Returns - const currentValue (integer)

    // Call function to get latest data from spa
    const data = await this.spaData();
    // Parse the data to check the heater state
    // 0 - OFF, 1 - HEATING, 2 - COOLING
    let currentValue = data.split('\r\n')[4].split(',')[13] as unknown as number; // Will only be a '0' or '1'
    if (currentValue === 1){
      // This means the heater is on, but it could be heating or cooling
      const waterTemp = data.split('\r\n')[4].split(',')[16] as unknown as number;
      const setTemp = data.split('\r\n')[5].split(',')[9] as unknown as number;
      if (waterTemp > setTemp){
        const heatState = data.split('\r\n')[6].split(',')[27] as unknown as number;
        if (heatState === 0 || heatState === 2){
          currentValue = 2; // Heater is cooling not heating
        }
      }
    }

    this.platform.log.debug('Get Characteristic On ->', currentValue);
    callback(null, currentValue);
  }

  /////////////////////////////
  // FUNCTION - GETTARGSTATE //
  /////////////////////////////
  async getTargState(callback: CharacteristicGetCallback) {
    // getTargState - Check whether the heater is set to off, heating, cooling or auto
    // Returns - const currentValue (integer)

    // Call function to get latest data from spa
    const data = await this.spaData();
    // Parse the data to check the heater state
    // 0 - OFF, 1 - HEATING, 2 - COOLING, 3 - AUTO
    let currentValue = data.split('\r\n')[6].split(',')[27] as unknown as number;
    if (currentValue === 0){
      currentValue = 3;
    } else if (currentValue === 3){
      currentValue = 0;
    }

    this.platform.log.debug('Get Characteristic On ->', currentValue);
    callback(null, currentValue);
  }

  /////////////////////////////
  // FUNCTION - SETTARGSTATE //
  /////////////////////////////
  async setTargState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // setTargState - Set the heater mode to off, heat, cool or auto
    // Input - value as string (string)
    
    // Connect to socket and write data
    const client = new net.Socket();
    try {
      client.connect(9090, this.accessory.context.spaIp, () => {
        try {
          client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
          // Send command to set mode
          let valueInt = value as string;
          if (valueInt === '0'){
            valueInt = '3';
          } else if (valueInt === '3'){
            valueInt = '0';
          }
          client.write('W99:' + valueInt + '\n');
        } catch {
          this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
          this.platform.log.warn('Failed to set characteristic for spa device');
          client.destroy();
          callback(null);
        }
      });
    } catch {
      this.platform.log.error('Error: The websocket connection to the spa failed. Please check your network connection and that the spa is online by trying to connect in the official SpaLINK app.');
      this.platform.log.warn('Failed to set characteristic for spa device ->', value);
      client.destroy();
      callback(null);
    }

    this.platform.log.debug('Set Characteristic On ->', value);
    callback(null);
  }

  ///////////////////////////
  // FUNCTION - GETCURTEMP //
  ///////////////////////////
  async getCurTemp(callback: CharacteristicGetCallback) {
    // getCurTemp - Get the current actual water temperature
    // Returns - const currentValue (float)

    // Call function to get latest data from spa
    const data = await this.spaData();
    // Parse the data to check the water temperature
    const currentValueString = data.split('\r\n')[4].split(',')[16] as string;
    // Convert to float
    const currentValueInt = String(currentValueString).slice(0, -1) + '.' + String(currentValueString).slice(-1);
    const currentValue = parseFloat(currentValueInt);

    this.platform.log.debug('Get Characteristic On ->', currentValue);
    callback(null, currentValue);
  }

  ////////////////////////////
  // FUNCTION - GETTARGTEMP //
  ////////////////////////////
  async getTargTemp(callback: CharacteristicGetCallback) {
    // getTargTemp - Get the set temperature for the spa water
    // Returns - const currentValue (float)

    // Call function to get latest data from spa
    const data = await this.spaData();
    // Parse the data to check the set water temperature
    const currentValueString = data.split('\r\n')[5].split(',')[9] as string;
    // Convert to float
    const currentValueInt = String(currentValueString).slice(0, -1) + '.' + String(currentValueString).slice(-1);
    const currentValue = parseFloat(currentValueInt);

    this.platform.log.debug('Get Characteristic On ->', currentValue);
    callback(null, currentValue);
  }

  ////////////////////////////
  // FUNCTION - SETTARGTEMP //
  ////////////////////////////
  async setTargTemp(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // setTargTemp - Set the temperature for the water heater
    // Input - value as string (string)
    
    // Connect to socket and write data
    const client = new net.Socket();
    try {
      client.connect(9090, this.accessory.context.spaIp, () => {
        try {
          client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
          // Send command to set temperature
          let valueString = value as string;
          if (valueString.includes('.')){
            if (valueString[2] === '.'){
              valueString = valueString.replace('.', '');
              valueString = valueString.slice(0, 3);
            } else {
              valueString = valueString.replace('.', '');
              valueString = valueString.slice(0, 2);
              valueString = '0' + valueString;
            }
          } else {
            if (valueString.length === 2){
              valueString = valueString + '0';
            } else {
              valueString = '0' + valueString + '0';
            }
          }
          
          client.write('W40:' + valueString + '\n');
        } catch {
          this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
          this.platform.log.warn('Failed to set characteristic for spa device');
          client.destroy();
          callback(null);
        }
      });
    } catch {
      this.platform.log.error('Error: The websocket connection to the spa failed. Please check your network connection and that the spa is online by trying to connect in the official SpaLINK app.');
      this.platform.log.warn('Failed to set characteristic for spa device ->', value);
      client.destroy();
      callback(null);
    }

    this.platform.log.debug('Set Characteristic On ->', value);
    callback(null);
  }

  /////////////////////////
  // FUNCTION - GETUNITS //
  /////////////////////////
  async getUnits(callback: CharacteristicGetCallback) {
    // getUnits - Get display units being used by the spa
    // Returns - const currentValue (number)

    // Units can only be celcius
    const currentValue = 0;

    this.platform.log.debug('Get Characteristic On ->', currentValue);
    callback(null, currentValue);
  }

  ////////////////////////////
  // FUNCTION - GETFANSPEED //
  ////////////////////////////
  async getFanSpeed(callback: CharacteristicGetCallback) {
    // getFanSpeed - Get the speed for the spa blower
    // Returns - const currentValue (number)

    // Call function to get latest data from spa
    const data = await this.spaData();
    // Parse the data to check the blower speed
    const currentValue = data.split('\r\n')[5].split(',')[2] as unknown as number;

    this.platform.log.debug('Get Characteristic On ->', currentValue);
    callback(null, currentValue);
  }

  ////////////////////////////
  // FUNCTION - SETFANSPEED //
  ////////////////////////////
  async setFanSpeed(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // setFanSpeed - Set the speed for the spa blower
    // Input - value as string (string)
    
    // Connect to socket and write data
    const client = new net.Socket();
    try {
      client.connect(9090, this.accessory.context.spaIp, () => {
        try {
          client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
          // Send command to set fan speed
          const valueString = value as string;
          client.write('W99:' + valueString + '\n');
        } catch {
          this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
          this.platform.log.warn('Failed to set characteristic for spa device');
          client.destroy();
          callback(null);
        }
      });
    } catch {
      this.platform.log.error('Error: The websocket connection to the spa failed. Please check your network connection and that the spa is online by trying to connect in the official SpaLINK app.');
      this.platform.log.warn('Failed to set characteristic for spa device ->', value);
      client.destroy();
      callback(null);
    }

    this.platform.log.debug('Set Characteristic On ->', value);
    callback(null);
  }

  //////////////////////////////
  // FUNCTION - GETBRIGHTNESS //
  //////////////////////////////
  async getBrightness(callback: CharacteristicGetCallback) {
    // getBrightness - Get the brightness for the spa lights
    // Returns - const currentValue (number)

    // Call function to get latest data from spa
    const data = await this.spaData();
    // Parse the data to check the light brightness
    const currentValue = data.split('\r\n')[5].split(',')[3] as unknown as number;

    this.platform.log.debug('Get Characteristic On ->', currentValue);
    callback(null, currentValue);
  }

  //////////////////////////////
  // FUNCTION - SETBRIGHTNESS //
  //////////////////////////////
  async setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // setBrightness - Set the brightness for the spa lights
    // Input - value as string (string)
    
    // Connect to socket and write data
    const client = new net.Socket();
    try {
      client.connect(9090, this.accessory.context.spaIp, () => {
        try {
          client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
          // Send command to set brightness
          const valueString = value as string;
          client.write('S08:' + valueString + '\n');
        } catch {
          this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
          this.platform.log.warn('Failed to set characteristic for spa device');
          client.destroy();
          callback(null);
        }
      });
    } catch {
      this.platform.log.error('Error: The websocket connection to the spa failed. Please check your network connection and that the spa is online by trying to connect in the official SpaLINK app.');
      this.platform.log.warn('Failed to set characteristic for spa device ->', value);
      client.destroy();
      callback(null);
    }

    this.platform.log.debug('Set Characteristic On ->', value);
    callback(null);
  }

  ////////////////////////////
  // FUNCTION - GETCURLOCK //
  ////////////////////////////
  async getCurLock(callback: CharacteristicGetCallback) {
    // getCurLock - Get the current lock state for the keypad lock
    // Returns - const currentValue (number)

    // Call function to get latest data from spa
    const data = await this.spaData();
    // Parse the data to check the lock state
    let currentValue = data.split('\r\n')[12].split(',')[13] as unknown as number;
    if (currentValue === 2){
      currentValue = 1;
    }

    this.platform.log.debug('Get Characteristic On ->', currentValue);
    callback(null, currentValue);
  }

  ////////////////////////////
  // FUNCTION - GETTARGLOCK //
  ////////////////////////////
  async getTargLock(callback: CharacteristicGetCallback) {
    // getTargLock - Get the current lock state for the keypad lock
    // Returns - const currentValue (number)

    // Call function to get latest data from spa
    const data = await this.spaData();
    // Parse the data to check the lock state
    let currentValue = data.split('\r\n')[12].split(',')[13] as unknown as number;
    if (currentValue === 2){
      currentValue = 1;
    }

    this.platform.log.debug('Get Characteristic On ->', currentValue);
    callback(null, currentValue);
  }

  ////////////////////////////
  // FUNCTION - SETTARGLOCK //
  ////////////////////////////
  async setTargLock(value: CharacteristicValue, context) {
    this.platform.log.info(context);
    // setTargLock - Set the target lock state for the keypad lock
    // Input - value as string (string)
    
    // Connect to socket and write data
    //return new Promise<void>((resolve) => {
    const client = new net.Socket();
    client.connect(9090, context.spaIp, () => {
      client.write('<connect--' + context.spaSocket + '--' + context.spaMember + '>');
      // Send command to set lock state
      if (value === 0){
        client.write('S21:0\n');
      } else {
        client.write('S21:2\n');
      }
      //resolve();
    });
    //  this.platform.log.debug('Set Characteristic On ->', value);
    //});
  }
}