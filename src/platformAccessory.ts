/* eslint-disable max-len */
import net = require('net');
import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { SpaNETHomebridgePlatform } from './platform';

////////////////////////
// PLATFORM ACCESSORY //
////////////////////////
export class SpaNETPlatformAccessory {
  private service: Array<Service>;

  constructor(
    private readonly platform: SpaNETHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Blake Tourneur')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.deviceId)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.deviceId);

    // Create the service for this accessory and register GET/SET handlers
    switch(accessory.context.device.deviceClass) {
      case 'Thermostat': // Heater Cooler
        this.service = [this.accessory.getService(this.platform.Service.Thermostat) || this.accessory.addService(this.platform.Service.Thermostat)];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState) // Whether the heater is currently heating/cooling
          .on('get', this.getCurState.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState) // Whether the heater should be heating/cooling
          .on('get', this.getTargState.bind(this))
          .on('set', this.setTargState.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.CurrentTemperature) // Current temperature of the spa
          .on('get', this.getCurTemp.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.TargetTemperature) // Target temperature of the spa
          .on('get', this.getTargTemp.bind(this))
          .on('set', this.setTargTemp.bind(this))
          .setProps({ minValue: 5, maxValue: 41, minStep: 0.2});
        
        this.service[0].getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits) // Temperature units of the heater
          .on('get', (callback) => {
            callback(null, 0);
          })
          .setProps({minValue: 0, maxValue: 0});
        break;
      
      case 'Valve': // Jet
        this.service = [this.accessory.getService(this.platform.Service.Valve) || this.accessory.addService(this.platform.Service.Valve)];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.Active) // Whether the jet is on
          .on('get', async (callback) => {
            const data = await this.spaData();
            callback(null, data.split('\r\n')[this.accessory.context.spaReadLine].split(',')[this.accessory.context.spaReadBit] as unknown as number);
          })
          .on('set', async (value, callback) => {
            const client = new net.Socket();
            try {
              client.connect(9090, this.accessory.context.spaIp, () => {
                try {
                  client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
                  if (value as boolean) {
                    if (value) {
                      client.write(this.accessory.context.spaCommand + '1\n');
                    } else {
                      client.write(this.accessory.context.spaCommand + '0\n');
                    }
                    client.destroy();
                    callback(null);
                  }
                } catch {
                  this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
                  this.platform.log.warn('Failed to set characteristic for spa device');
                  client.destroy();
                  callback(null);
                }
              });
            } catch {
              this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
              this.platform.log.warn('Failed to set characteristic for spa device');
              client.destroy();
              callback(null);
            }
          });
        this.service[0].getCharacteristic(this.platform.Characteristic.InUse) // Whether the jet is on
          .on('get', async (callback) => {
            const data = await this.spaData();
            callback(null, data.split('\r\n')[this.accessory.context.spaReadLine].split(',')[this.accessory.context.spaReadBit] as unknown as number);
          });
        this.service[0].getCharacteristic(this.platform.Characteristic.ValveType)
          .on('get', (callback) => {
            callback(null, this.platform.Characteristic.ValveType.GENERIC_VALVE);
          });
        break;
      
      case 'Blower': // Fan
        this.service = [this.accessory.getService(this.platform.Service.Fan) || this.accessory.addService(this.platform.Service.Fan)];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.On) // Whether the blower is on
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.RotationSpeed) // Speed of the blower
          .on('get', this.getFanSpeed.bind(this))
          .on('set', this.setFanSpeed.bind(this))
          .setProps({minValue: 0, maxValue: 5, minStep: 1});
        break;
      
      case 'Lights': // Lightbulb
        this.service = [this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb)];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.On) // Whether the lights are on
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));

        this.service[0].getCharacteristic(this.platform.Characteristic.Brightness) // Whether the lights are on
          .on('get', this.getBrightness.bind(this))
          .on('set', this.setBrightness.bind(this))
          .setProps({minValue: 0, maxValue: 5, minStep: 1});
        break;
      
      case 'Lock': // Lock Mechanism
        this.service = [this.accessory.getService(this.platform.Service.LockMechanism) || this.accessory.addService(this.platform.Service.LockMechanism)];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.LockCurrentState) // Whether the keypad lock is unlocked/locked
          .on('get', this.getCurLock.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.LockTargetState) // Whether the keypad lock should be unlocked/locked
          .on('get', this.getTargLock.bind(this))
          .on('set', this.setTargLock.bind(this));
        break;
      
      case 'ModeSwitch': // Operation Mode Switch
        this.service = [this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch)];
        this.service.push(this.accessory.getService('Economy') || this.accessory.addService(this.platform.Service.Switch, 'Economy', accessory.context.device.deviceId + '-ECON'));
        this.service.push(this.accessory.getService('Away') || this.accessory.addService(this.platform.Service.Switch, 'Away', accessory.context.device.deviceId + '-AWAY'));
        this.service.push(this.accessory.getService('Week') || this.accessory.addService(this.platform.Service.Switch, 'Week', accessory.context.device.deviceId + '-WEEK'));
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, 'Normal');
        this.service[1].setCharacteristic(this.platform.Characteristic.Name, 'Economy');
        this.service[2].setCharacteristic(this.platform.Characteristic.Name, 'Away');
        this.service[3].setCharacteristic(this.platform.Characteristic.Name, 'Week');
        this.service[0].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .on('get', async (callback) => {
            const data = await this.spaData();
            const operMode = data.split('\r\n')[3].split(',')[2];
            if (operMode === 'NORM'){
              callback(null, true);
            } else {
              callback(null, false);
            }
          })
          .on('set', async (value, callback) => {
            const client = new net.Socket();
            try {
              client.connect(9090, this.accessory.context.spaIp, () => {
                try {
                  client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
                  if (value as boolean) {
                    client.write('W66:0\n');
                    this.service[1].updateCharacteristic(this.platform.Characteristic.On, false);
                    this.service[2].updateCharacteristic(this.platform.Characteristic.On, false);
                    this.service[3].updateCharacteristic(this.platform.Characteristic.On, false);
                    client.destroy();
                    callback(null);
                  }
                } catch {
                  this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
                  this.platform.log.warn('Failed to set characteristic for spa device');
                  client.destroy();
                  callback(null);
                }
              });
            } catch {
              this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
              this.platform.log.warn('Failed to set characteristic for spa device');
              client.destroy();
              callback(null);
            }
          });
        this.service[1].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .on('get', async (callback) => {
            const data = await this.spaData();
            const operMode = data.split('\r\n')[3].split(',')[2];
            if (operMode === 'ECON'){
              callback(null, true);
            } else {
              callback(null, false);
            }
          })
          .on('set', async (value, callback) => {
            const client = new net.Socket();
            try {
              client.connect(9090, this.accessory.context.spaIp, () => {
                try {
                  client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
                  if (value as boolean) {
                    client.write('W66:1\n');
                    this.service[0].updateCharacteristic(this.platform.Characteristic.On, false);
                    this.service[2].updateCharacteristic(this.platform.Characteristic.On, false);
                    this.service[3].updateCharacteristic(this.platform.Characteristic.On, false);
                    client.destroy();
                    callback(null);
                  }
                } catch {
                  this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
                  this.platform.log.warn('Failed to set characteristic for spa device');
                  client.destroy();
                  callback(null);
                }
              });
            } catch {
              this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
              this.platform.log.warn('Failed to set characteristic for spa device');
              client.destroy();
              callback(null);
            }
          });
        this.service[2].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .on('get', async (callback) => {
            const data = await this.spaData();
            const operMode = data.split('\r\n')[3].split(',')[2];
            if (operMode === 'AWAY'){
              callback(null, true);
            } else {
              callback(null, false);
            }
          })
          .on('set', async (value, callback) => {
            const client = new net.Socket();
            try {
              client.connect(9090, this.accessory.context.spaIp, () => {
                try {
                  client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
                  if (value as boolean) {
                    client.write('W66:2\n');
                    this.service[0].updateCharacteristic(this.platform.Characteristic.On, false);
                    this.service[1].updateCharacteristic(this.platform.Characteristic.On, false);
                    this.service[3].updateCharacteristic(this.platform.Characteristic.On, false);
                    client.destroy();
                    callback(null);
                  }
                } catch {
                  this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
                  this.platform.log.warn('Failed to set characteristic for spa device');
                  client.destroy();
                  callback(null);
                }
              });
            } catch {
              this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
              this.platform.log.warn('Failed to set characteristic for spa device');
              client.destroy();
              callback(null);
            }
          });
        this.service[3].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .on('get', async (callback) => {
            const data = await this.spaData();
            const operMode = data.split('\r\n')[3].split(',')[2];
            if (operMode === 'WEEK'){
              callback(null, true);
            } else {
              callback(null, false);
            }
          })
          .on('set', async (value, callback) => {
            const client = new net.Socket();
            try {
              client.connect(9090, this.accessory.context.spaIp, () => {
                try {
                  client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
                  if (value as boolean) {
                    client.write('W66:3\n');
                    this.service[0].updateCharacteristic(this.platform.Characteristic.On, false);
                    this.service[1].updateCharacteristic(this.platform.Characteristic.On, false);
                    this.service[2].updateCharacteristic(this.platform.Characteristic.On, false);
                    client.destroy();
                    callback(null);
                  }
                } catch {
                  this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
                  this.platform.log.warn('Failed to set characteristic for spa device');
                  client.destroy();
                  callback(null);
                }
              });
            } catch {
              this.platform.log.error('Error: Data transfer to the websocket failed, but connection was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
              this.platform.log.warn('Failed to set characteristic for spa device');
              client.destroy();
              callback(null);
            }
          });
        break;
      
      default: // Switch
        this.service = [this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch)];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .on('get', this.getOn.bind(this))
          .on('set', this.setOn.bind(this));
        break;
    }
  }

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
      case 'PowerSwitch': {
        const powerMode = data.split('\r\n')[5].split(',')[11] as unknown as number;
        isOn = false;
        if (powerMode > 0){
          isOn = true;
        }
        break;
      }
      default: {
        if (this.accessory.context.device.displayName === 'Clean'){
          isOn = data.split('\r\n')[4].split(',')[17] as unknown as boolean;
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
              if (value as boolean){
                client.write('S28:0\n');
              } else {
                client.write('S28:2\n');
              }
              break;
            }
            case 'Lights': {
              if (data.split('\r\n')[4].split(',')[15] as unknown as boolean !== value as boolean){
                client.write('W14\n');
              }
              break;
            }
            case 'PowerSwitch': {
              if (value as boolean){
                client.write('W63:1\n');
              } else {
                client.write('W63:0\n');
              }
              break;
            }
            default: {
              if (this.accessory.context.device.displayName === 'Clean'){
                const state = data.split('\r\n')[4].split(',')[17] as unknown as boolean;
                if (state !== value as boolean){
                  client.write('W12\n');
                }
              } else {
                let valueInt = value as number;
                if (this.accessory.context.device.displayName === 'Sleep'){
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
      currentValue = this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
    } else if (currentValue === 3){
      currentValue = this.platform.Characteristic.TargetHeatingCoolingState.OFF;
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
          if (value === this.platform.Characteristic.TargetHeatingCoolingState.OFF){
            valueInt = '3';
          } else if (value === this.platform.Characteristic.TargetHeatingCoolingState.AUTO){
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
          const valueSend = (value as number * 10).toFixed().padStart(3, '0');
          this.platform.log.debug('Set Characteristic On ->', valueSend);
          client.write('W40:' + valueSend + '\n');
          callback(null);
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
          if (value as number > 0) {
            client.write('S13:' + valueString + '\n');
            client.write('S28:0\n');
          } else {
            client.write('S28:2\n');
          }
          client.destroy();
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
          if (value as number > 0) {
            client.write('S08:' + valueString + '\n');
          } else {
            client.write('W14\n');
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

  ///////////////////////////
  // FUNCTION - GETCURLOCK //
  ///////////////////////////
  async getCurLock(callback) {
    // getCurLock - Get the current lock state for the keypad lock
    // Returns - const currentValue (number)

    // Call function to get latest data from spa
    this.platform.log.debug('Starting Get Characteristic LockTargState ->');
    const value = await new Promise<number>((resolve) => {
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
          // Parse the data to check the lock state
          const rawValue = data.toString().split('\r\n')[12].split(',')[13];
          this.platform.log.debug('Get Characteristic LockTargState ->', rawValue);
          if (rawValue === '0'){
            resolve(0);
          } else {
            resolve(1);
          }
        }
      });
    });
    callback(null, value);
  }

  ////////////////////////////
  // FUNCTION - GETTARGLOCK //
  ////////////////////////////
  async getTargLock(callback) {
    // getTargLock - Get the current lock state for the keypad lock
    // Returns - const currentValue (number)

    // Call function to get latest data from spa
    this.platform.log.debug('Starting Get Characteristic LockTargState ->');
    const value = await new Promise<number>((resolve) => {
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
          // Parse the data to check the lock state
          const rawValue = data.toString().split('\r\n')[12].split(',')[13];
          this.platform.log.debug('Get Characteristic LockTargState ->', rawValue);
          if (rawValue === '0'){
            resolve(0);
          } else {
            resolve(1);
          }
        }
      });
    });
    callback(null, value);
  }

  ////////////////////////////
  // FUNCTION - SETTARGLOCK //
  ////////////////////////////
  async setTargLock(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // setTargLock - Set the target lock state for the keypad lock
    // Input - value as string (string)
      
    // Connect to socket and write data
    const client = new net.Socket();
    try {
      client.connect(9090, this.accessory.context.spaIp, () => {
        try {
          client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
          // Send command to set lock state
          let valueString = value as string;
          if (valueString === '1'){
            valueString = '2';
          }
          client.write('S21:' + valueString + '\n');
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
}