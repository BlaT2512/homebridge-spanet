import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
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
        this.service = [
          this.accessory.getService(this.platform.Service.Thermostat) ||
          this.accessory.addService(this.platform.Service.Thermostat),
        ];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState) // Whether spa is heating/cooling
          .onGet(this.getCurState.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState) // Whether spa should be heating/cooling
          .onGet(this.getTargState.bind(this))
          .onSet(this.setTargState.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.CurrentTemperature) // Current temperature of the spa
          .onGet(this.getCurTemp.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.TargetTemperature) // Target temperature of the spa
          .onGet(this.getTargTemp.bind(this))
          .onSet(this.setTargTemp.bind(this))
          .setProps({ minValue: 5, maxValue: 41, minStep: 0.2});
        
        this.service[0].getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits) // Temperature units of the heater
          .onGet(async() => {
            return 0;
          })
          .setProps({minValue: 0, maxValue: 0});
        break;
      
      case 'Valve': // Jet
        this.service = [
          this.accessory.getService(this.platform.Service.Valve) ||
          this.accessory.addService(this.platform.Service.Valve),
        ];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.Active) // Whether the jet is on
          .onGet(this.getOn.bind(this))
          .onSet(this.setOn.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.InUse) // Whether the jet is on
          .onGet(this.getOn.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.ValveType) // Type of valve this is
          .onGet(async() => {
            return 2; 
          });
        
        this.service[0].getCharacteristic(this.platform.Characteristic.SetDuration) // How long the timeout for jet is
          .onGet(this.getTimeout.bind(this))
          .onSet(this.setTimeout.bind(this))
          .setProps({minValue: 0, maxValue: 3600, minStep: 60});
        break;
      
      case 'Blower': // Fan
        this.service = [
          this.accessory.getService(this.platform.Service.Fan) ||
          this.accessory.addService(this.platform.Service.Fan),
        ];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.On) // Whether the blower is on
          .onGet(this.getOn.bind(this))
          .onSet(this.setOn.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.RotationSpeed) // Speed of the blower
          .onGet(this.getBlowerSpeed.bind(this))
          .onSet(this.setBlowerSpeed.bind(this))
          .setProps({minValue: 0, maxValue: 5, minStep: 1});
        break;
      
      case 'Lights': // Lightbulb
        this.service = [
          this.accessory.getService(this.platform.Service.Lightbulb) ||
          this.accessory.addService(this.platform.Service.Lightbulb),
        ];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.On) // Whether the lights are on
          .onGet(this.getOn.bind(this))
          .onSet(this.setOn.bind(this));

        this.service[0].getCharacteristic(this.platform.Characteristic.Brightness) // Brightness of the lights
          .onGet(this.getBrightness.bind(this))
          .onSet(this.setBrightness.bind(this))
          .setProps({minValue: 0, maxValue: 5, minStep: 1});
        break;
      
      case 'Lock': // Lock Mechanism
        this.service = [
          this.accessory.getService(this.platform.Service.LockMechanism) ||
          this.accessory.addService(this.platform.Service.LockMechanism),
        ];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.LockCurrentState) // Whether the keypad lock is unlocked/locked
          .onGet(this.getLock.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.LockTargetState) // Whether the keypad lock should be unlocked/locked
          .onGet(this.getLock.bind(this))
          .onSet(this.setLock.bind(this));
        break;
      
      case 'ModeSwitch': // Operation Mode Switch
        this.service = [
          this.accessory.getService(this.platform.Service.Switch) ||
          this.accessory.addService(this.platform.Service.Switch),
        ];
        this.service.push (
          this.accessory.getService('Economy') ||
          this.accessory.addService(this.platform.Service.Switch, 'Economy', accessory.context.device.deviceId + '-ECON'),
        );
        this.service.push (
          this.accessory.getService('Away') ||
          this.accessory.addService(this.platform.Service.Switch, 'Away', accessory.context.device.deviceId + '-AWAY'),
        );
        this.service.push (
          this.accessory.getService('Week') ||
          this.accessory.addService(this.platform.Service.Switch, 'Week', accessory.context.device.deviceId + '-WEEK'),
        );
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, 'Normal');
        this.service[1].setCharacteristic(this.platform.Characteristic.Name, 'Economy');
        this.service[2].setCharacteristic(this.platform.Characteristic.Name, 'Away');
        this.service[3].setCharacteristic(this.platform.Characteristic.Name, 'Week');
        this.service[0].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .onGet(this.getOperMode.bind(this, 1))
          .onSet(async (value) => {
            this.setOperMode.bind(this, value, 1);
          });
        this.service[1].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .onGet(this.getOperMode.bind(this, 2))
          .onSet(async (value) => {
            this.setOperMode.bind(this, value, 2);
          });
        this.service[2].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .onGet(this.getOperMode.bind(this, 3))
          .onSet(async (value) => {
            this.setOperMode.bind(this, value, 3);
          });
        this.service[3].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .onGet(this.getOperMode.bind(this, 4))
          .onSet(async (value) => {
            this.setOperMode.bind(this, value, 4);
          });
        break;
      
      default: // Switch
        this.service = [
          this.accessory.getService(this.platform.Service.Switch) ||
          this.accessory.addService(this.platform.Service.Switch),
        ];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .onGet(this.getOn.bind(this))
          .onSet(this.setOn.bind(this));
        break;
    }
  }

  //////////////////////
  // FUNCTION - GETON //
  //////////////////////
  async getOn(): Promise<boolean> {
    // getOn - Check whether the switch or device is on/active
    // Returns - boolean
    switch (this.accessory.context.device.deviceClass) {
      case 'Blower': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spanetapi.get('/PumpsAndBlower/Get/' + this.platform.spaId, { id: 'PumpsAndBlower' })
            .then((response) => {
              this.platform.log.debug('Get Characteristic Blower On ->', response.data.pumpAndBlower.blower.blowerStatus !== 'off');
              resolve(response.data.pumpAndBlower.blower.blowerStatus !== 'off');
            })
            .catch(() => {
              reject(new Error('Failed to get blower on characteristic for spa device'));
            });
        });
      }
      case 'Valve': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spanetapi.get('/PumpsAndBlower/Get/' + this.platform.spaId, { id: 'PumpsAndBlower' })
            .then((response) => {
              const pumps = response.data.pumpAndBlower.pumps;
              for (const pump of pumps) {
                if (pump.id === this.accessory.context.device.apiId) {
                  this.platform.log.debug('Get Characteristic Jet On ->', pump.pumpStatus === 'on');
                  resolve(pump.pumpStatus === 'on');
                  return;
                }
              }
              reject(new Error('Failed to get jet active characteristic for spa device'));
            })
            .catch(() => {
              reject(new Error('Failed to get jet active characteristic for spa device'));
            });
        });
      }
      case 'Lights': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spanetapi.get('/Lights/GetLightDetails/' + this.platform.spaId, { id: 'LightDetails' })
            .then((response) => {
              this.platform.log.debug('Get Characteristic Lights On ->', response.data.lightOn as boolean);
              resolve(response.data.lightOn as boolean);
            })
            .catch(() => {
              reject(new Error('Failed to get lights on characteristic for spa device'));
            });
        });
      }
      case 'PowerSwitch': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spanetapi.get('/Settings/PowerSave/' + this.platform.spaId, { id: 'PowerSave' })
            .then((response) => {
              this.platform.log.debug('Get Characteristic Power Save On ->', response.data.mode as number > 1);
              resolve(response.data.mode as number > 1);
            })
            .catch(() => {
              reject(new Error('Failed to get power save on characteristic for spa device'));
            });
        });
      }
      case 'SanitiseSwitch': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spanetapi.get('/Dashboard/' + this.platform.spaId, { id: 'Dashboard' })
            .then((response) => {
              this.platform.log.debug('Get Characteristic Sanitise On ->', response.data.sanitiseOn as boolean);
              resolve(response.data.sanitiseOn as boolean);
            })
            .catch(() => {
              reject(new Error('Failed to get sanitise on characteristic for spa device'));
            });
        });
      }
      case 'SleepSwitch': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spanetapi.get('/SleepTimers/' + this.platform.spaId, { id: 'SleepTimers' })
            .then((response) => {
              const sleepTimers = response.data;
              for (const sleepTimer of sleepTimers) {
                if (sleepTimer.id === this.accessory.context.device.apiId) {
                  this.platform.log.debug('Get Characteristic Sleep Timer On ->', sleepTimer.isEnabled as boolean);
                  resolve(sleepTimer.isEnabled as boolean);
                  return;
                }
              }
              reject(new Error('Failed to get sleep timer on characteristic for spa device'));
            })
            .catch(() => {
              reject(new Error('Failed to get sleep timer on characteristic for spa device'));
            });
        });
      }
      default: {
        throw new Error('Unknown device class requesting on characteristic for spa device');
      }
    }
  }

  //////////////////////////
  // FUNCTION - CHECKAUTH //
  //////////////////////////
  /*async refreshAuth() {
    if (Date.now() >= this.platform.accessTokenExpiry * 1000) {
      this.platform.spanetapi.post('/OAuth/Token', {
        'refreshToken': this.platform.refreshToken,
        'userDeviceId': this.platform.userdeviceid,
      })
        .then((response) => {


        })
        .catch(() => {
          throw new Error('Failed to refresh JWT token');
        });
    } else {
      return;
    }
  }*/

  //////////////////////
  // FUNCTION - SETON //
  //////////////////////
  async setOn(value: CharacteristicValue): Promise<null> {
    // setOn - Sets the switch or device's on/active state
    // Input - boolean
    switch (this.accessory.context.device.deviceClass) {
      case 'Blower': {
        return new Promise((resolve, reject) => {
          this.platform.spanetapi.get('/PumpsAndBlower/Get/' + this.platform.spaId, { id: 'PumpsAndBlower' })
            .then((response) => {
              const blowerSpeed = response.data.pumpAndBlower.blower.blowerVariableSpeed as number;
    
              this.platform.spanetapi.put('/PumpsAndBlower/SetPump/' + this.accessory.context.device.apiId, {
                'deviceId': this.platform.spaId,
                'modeId': value as boolean ? 2 : 1,
                'speed': blowerSpeed,
              }, { cache: { update: { 'PumpsAndBlower': 'delete' } } })
                .then(() => {
                  resolve;
                })
                .catch(() => {
                  reject(new Error('Failed to set blower on characteristic for spa device'));
                });
            })
            .catch(() => {
              reject(new Error('Failed to set blower on characteristic for spa device'));
            });
        });
      }
      case 'Valve': {
        return new Promise((resolve, reject) => {
          this.platform.spanetapi.get('/PumpsAndBlower/Get/' + this.platform.spaId, { id: 'PumpsAndBlower' })
            .then((response) => {
              let pumpVariableSpeed = 0;
              const pumps = response.data.pumpAndBlower.pumps;
              for (const pump of pumps) {
                if (pump.id === this.accessory.context.device.apiId) {
                  pumpVariableSpeed = pump.pumpVariableSpeed as number;
                }
              }

              this.platform.spanetapi.put('/PumpsAndBlower/SetPump/' + this.accessory.context.device.apiId, {
                'deviceId': this.platform.spaId,
                'modeId': (value as boolean) ? 1 : 2,
                'pumpVariableSpeed': pumpVariableSpeed,
              }, { cache: { update: { 'PumpsAndBlower': 'delete' } } })
                .then(() => {
                  resolve;
                })
                .catch(() => {
                  reject(new Error('Failed to set jet active characteristic for spa device'));
                });
            })
            .catch(() => {
              reject(new Error('Failed to set jet active characteristic for spa device'));
            });
        });
      }
      case 'Lights': {
        return new Promise((resolve, reject) => {
          this.platform.spanetapi.put('/Lights/SetLightStatus/' + this.accessory.context.device.apiId, {
            'deviceId': this.platform.spaId,
            'on': value as boolean,
          }, { cache: { update: { 'LightDetails': 'delete' } } })
            .then(() => {
              resolve;
            })
            .catch(() => {
              reject(new Error('Failed to set lights on characteristic for spa device'));
            });
        });
      }
      case 'PowerSwitch': {
        return new Promise((resolve, reject) => {
          this.platform.spanetapi.put('/Settings/PowerSave/' + this.platform.spaId, {
            'mode': value as boolean ? 3 : 1,
          }, { cache: { update: { 'PowerSave': 'delete' } } })
            .then(() => {
              resolve;
            })
            .catch(() => {
              reject(new Error('Failed to set power save on characteristic for spa device'));
            });
        });
      }
      case 'SanitiseSwitch': {
        return new Promise((resolve, reject) => {
          this.platform.spanetapi.put('/Settings/SanitiseStatus/' + this.accessory.context.device.apiId, {
            'on': value as boolean,
          }, { cache: { update: { 'Dashboard': 'delete' } } })
            .then(() => {
              resolve;
            })
            .catch(() => {
              reject(new Error('Failed to set sanitise on characteristic for spa device'));
            });
        });
      }
      case 'SleepSwitch': {
        return new Promise((resolve, reject) => {
          this.platform.spanetapi.get('/SleepTimers/' + this.platform.spaId, { id: 'SleepTimers' })
            .then((response) => {
              for (const sleepTimer of response.data) {
                if (sleepTimer.id === this.accessory.context.device.apiId) {
                  this.platform.spanetapi.put('/SleepTimers/' + this.accessory.context.device.apiId, {
                    'deviceId': this.platform.spaId,
                    'timerNumber': sleepTimer.timerNumber,
                    'timerName': sleepTimer.timerName,
                    'startTime': sleepTimer.startTIme,
                    'endTime': sleepTimer.endTime,
                    'daysHex': sleepTimer.daysHex,
                    'isEnabled': value as boolean,
                  }, { cache: { update: { 'SleepTimers': 'delete' } } })
                    .then(() => {
                      resolve;
                    })
                    .catch(() => {
                      reject(new Error('Failed to set sleep timer on characteristic for spa device'));
                    });
                }
              }
              reject(new Error('Failed to set sleep timer on characteristic for spa device'));
            })
            .catch(() => {
              reject(new Error('Failed to set sleep timer on characteristic for spa device'));
            });
        });
      }
      default: {
        throw new Error('Unknown device class setting on characteristic for spa device');
      }
    }
  }
  
  ////////////////////////////
  // FUNCTION - GETOPERMODE //
  ////////////////////////////
  async getOperMode(targetMode: number): Promise<boolean> {
    // getOperMode - Gets the current spa operation mode
    // Input - number (0 - Normal, 1 - Economy, 2 - Away, 3 - Weekends)
    // Returns - boolean
    return new Promise<boolean>((resolve, reject) => {
      this.platform.spanetapi.get('/Settings/OperationMode/' + this.platform.spaId, { id: 'OperationMode' })
        .then((response) => {
          this.platform.log.debug('Get Characteristic Operation Mode ->', response.data as number === targetMode);
          resolve(response.data as number === targetMode);  
        })
        .catch(() => {
          reject(new Error('Failed to get operation mode characteristic for spa device')); 
        });
    });
  }

  ////////////////////////////
  // FUNCTION - SETOPERMODE //
  ////////////////////////////
  async setOperMode(value: CharacteristicValue, targetMode: number): Promise<null> {
    // setOperMode - Sets the current spa operation mode
    // Input - number (0 - Inactive, 1 - Idle, 2 - Heat, 3 - Cool)
    return new Promise((resolve, reject) => {
      if (value as boolean === false) {
        this.service[targetMode-1].updateCharacteristic(this.platform.Characteristic.On, true);
        resolve;
        return;

      } else {
        this.platform.spanetapi.put('/Settings/OperationMode/' + this.platform.spaId, {
          'mode': targetMode,
        }, { cache: { update: { 'OperationMode': 'delete' } } })
          .then(() => {
            if (targetMode !== 1) {
              this.service[0].updateCharacteristic(this.platform.Characteristic.On, false);
            }
            if (targetMode !== 2) {
              this.service[1].updateCharacteristic(this.platform.Characteristic.On, false);
            }
            if (targetMode !== 3) {
              this.service[2].updateCharacteristic(this.platform.Characteristic.On, false);
            }
            if (targetMode !== 4) {
              this.service[3].updateCharacteristic(this.platform.Characteristic.On, false);
            }
            resolve;
          })
          .catch(() => {
            reject(new Error('Failed to set operation mode characteristic for spa device'));
          });
      }
    });
  }

  ////////////////////////////
  // FUNCTION - GETCURSTATE //
  ////////////////////////////
  async getCurState(): Promise<number> {
    // getCurState - Check whether the heater is off, heating or cooling
    // Returns - number (0 - Off, 1 - Heat, 2 - Cool)
    return new Promise<number>((resolve, reject) => {
      this.platform.spanetapi.get('/Information/' + this.platform.spaId, { id: 'Information' })
        .then((response) => {
          if (response.data.information.informationStatus.heater as string === '0') {
            this.platform.log.debug('Get Characteristic Current Heating State ->', 0);
            resolve(0);
  
          } else {
            // Heating if current temperature too low, cooling if current temperature too high
            this.platform.spanetapi.get('/Dashboard/' + this.platform.spaId, { id: 'Dashboard' })
              .then((response) => {
                this.platform.log.debug('Get Characteristic Current Heating State ->',
                  (response.data.setTemperature as number - response.data.currentTemperature as number > 0) ? 1 : 2,
                );
                resolve((response.data.setTemperature as number - response.data.currentTemperature as number > 0) ? 1 : 2);
              })
              .catch(() => {
                reject(new Error('Failed to get current heater state characteristic for spa device'));
              });
          }
        })
        .catch(() => {
          reject(new Error('Failed to get current heater state characteristic for spa device'));
        });
    });
  }

  /////////////////////////////
  // FUNCTION - GETTARGSTATE //
  /////////////////////////////
  async getTargState(): Promise<number> {
    // getTargState - Check whether the heater is set to off, heating, cooling or auto
    // Returns - number (0 - Off, 1 - Heat, 2 - Cool, 3 - Auto)
    return new Promise<number>((resolve, reject) => {
      this.platform.spanetapi.get('/Settings/HeatPumpMode/' + this.platform.spaId, { id: 'HeatPumpMode' })
        .then((response) => {
          const rawmode = response.data.mode as number;
          const mode = rawmode === 1 ? 3 : rawmode === 2 ? 1 : rawmode === 3 ? 2 : 0;
          this.platform.log.debug('Get Characteristic Target Heating State ->', mode);
          resolve(mode);
        })
        .catch(() => {
          reject(new Error('Failed to get target heater state characteristic for spa device')); 
        });
    });
  }

  /////////////////////////////
  // FUNCTION - SETTARGSTATE //
  /////////////////////////////
  async setTargState(value: CharacteristicValue): Promise<null> {
    // setTargState - Set the heater mode to off, heat, cool or auto
    // Input - number (0 - Off, 1 - Heat, 2 - Cool, 3 - Auto)
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.put('/Settings/SetHeatPumpMode/' + this.platform.spaId, {
        'mode': value === 0 ? 4 : value === 1 ? 2 : value === 2 ? 3 : 1,  
      }, { cache: { update: { 'HeatPumpMode': 'delete' } } })
        .then(() => {
          resolve;
        })
        .catch(() => {
          reject(new Error('Failed to set target heater state characteristic for spa device'));
        });
    });
  }

  ///////////////////////////
  // FUNCTION - GETCURTEMP //
  ///////////////////////////
  async getCurTemp(): Promise<number> {
    // getCurTemp - Get the current actual water temperature
    // Returns - number (-270.0 - 100.0)
    return new Promise<number>((resolve, reject) => {
      this.platform.spanetapi.get('/Dashboard/' + this.platform.spaId, { id: 'Dashboard' })
        .then((response) => {
          this.platform.log.debug('Get Characteristic Current Temperature ->', response.data.currentTemperature as number / 10);
          resolve(response.data.currentTemperature as number / 10);
        })
        .catch(() => {
          reject(new Error('Failed to get current temperature characteristic for spa device')); 
        });
    });
  }

  ////////////////////////////
  // FUNCTION - GETTARGTEMP //
  ////////////////////////////
  async getTargTemp(): Promise<number> {
    // getTargTemp - Get the set temperature for the spa water
    // Returns - number (-270.0 - 100.0)
    return new Promise<number>((resolve, reject) => {
      this.platform.spanetapi.get('/Dashboard/' + this.platform.spaId, { id: 'Dashboard' })
        .then((response) => {
          this.platform.log.debug('Get Characteristic Target Temperature ->', response.data.setTemperature as number / 10);
          resolve(response.data.setTemperature as number / 10);
        })
        .catch(() => {
          reject(new Error('Failed to get target temperature characteristic for spa device'));
        });
    });
  }

  ////////////////////////////
  // FUNCTION - SETTARGTEMP //
  ////////////////////////////
  async setTargTemp(value: CharacteristicValue): Promise<null> {
    // setTargTemp - Set the temperature for the water heater
    // Input - value as string (string)
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.put('/Dashboard/' + this.platform.spaId, {
        'temperature': value as number * 10,  
      }, { cache: { update: { 'Dashboard': 'delete' } } })
        .then(() => {
          resolve;
        })
        .catch(() => {
          reject(new Error('Failed to set target temperature characteristic for spa device'));
        });
    });
  }

  ///////////////////////////
  // FUNCTION - GETTIMEOUT //
  ///////////////////////////
  async getTimeout(): Promise<number> {
    // getTimeout - Get the timeout for the spa jets
    // Returns - number (0-3600)
    return new Promise<number>((resolve, reject) => {
      this.platform.spanetapi.get('/Settings/Timeout/' + this.platform.spaId, { id: 'Timeout' })
        .then((response) => {
          this.platform.log.debug('Get Characteristic Jet Timeout ->', response.data as number * 60);
          resolve(response.data as number * 60);
        })
        .catch((error) => {
          this.platform.log.warn('################');
          this.platform.log.warn(error);
          reject(new Error('Failed to get jet timeout characteristic for spa device'));
        });
    });
  }

  async setTimeout(value: CharacteristicValue): Promise<null> {
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.put('/Settings/Timeout/' + this.platform.spaId, {
        'timeout': value as number / 60, 
      }, { cache: { update: { 'Timeout': 'delete' } } })
        .then(() => {
          resolve;
        })
        .catch(() => {
          reject(new Error('Failed to set jet active characteristic for spa device'));
        });
    });
  }

  ///////////////////////////////
  // FUNCTION - GETBLOWERSPEED //
  ///////////////////////////////
  async getBlowerSpeed(): Promise<number> {
    // getBlowerSpeed - Get the speed for the spa blower
    // Returns - number (1-5)
    return new Promise<number>((resolve, reject) => {
      this.platform.spanetapi.get('/PumpsAndBlower/Get/' + this.platform.spaId, { id: 'PumpsAndBlower' })
        .then((response) => {
          this.platform.log.debug('Get Characteristic Blower Speed ->', response.data.pumpAndBlower.blower.blowerVariableSpeed as number);
          resolve(response.data.pumpAndBlower.blower.blowerVariableSpeed as number);
        })
        .catch(() => {
          reject(new Error('Failed to get blower speed characteristic for spa device'));
        });
    });
  }

  ///////////////////////////////
  // FUNCTION - SETBLOWERSPEED //
  ///////////////////////////////
  async setBlowerSpeed(value: CharacteristicValue): Promise<null> {
    // setBlowerSpeed - Set the speed for the spa blower
    // Input - number (1-5)
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.get('/PumpsAndBlower/Get/' + this.platform.spaId, { id: 'PumpsAndBlower' })
        .then((response) => {
          const blowerModeRaw = response.data.pumpAndBlower.blower.blowerStatus as string;
          const blowerMode = blowerModeRaw === 'vari' ? 2 : blowerModeRaw === 'ramp' ? 3 : 1;

          this.platform.spanetapi.put('/PumpsAndBlower/SetPump/' + this.accessory.context.device.apiId, {
            'deviceId': this.platform.spaId,
            'modeId': blowerMode,
            'speed': value as number,
          }, { cache: { update: { 'PumpsAndBlower': 'delete' } } })
            .then(() => {
              resolve;
            })
            .catch(() => {
              reject(new Error('Failed to set blower speed characteristic for spa device'));
            });
        })
        .catch(() => {
          reject(new Error('Failed to set blower speed characteristic for spa device'));
        });
    });
  }

  //////////////////////////////
  // FUNCTION - GETBRIGHTNESS //
  //////////////////////////////
  async getBrightness(): Promise<number> {
    // getBrightness - Get the brightness for the spa lights
    // Returns - number (1-5)
    return new Promise<number>((resolve, reject) => {
      this.platform.spanetapi.get('/Lights/GetLightDetails/' + this.platform.spaId, { id: 'LightDetails' })
        .then((response) => {
          this.platform.log.debug('Get Characteristic Lights Brightness ->', response.data.lightBrightness as number);
          resolve(response.data.lightBrightness as number);
        })
        .catch(() => {
          reject(new Error('Failed to get lights brightness characteristic for spa device'));
        });
    });
  }

  //////////////////////////////
  // FUNCTION - SETBRIGHTNESS //
  //////////////////////////////
  async setBrightness(value: CharacteristicValue): Promise<null> {
    // setBrightness - Set the brightness for the spa lights
    // Input - number (1-5)
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.put('/Lights/SetLightBrightness/' + this.accessory.context.device.apiId, {
        'deviceId': this.platform.spaId,
        'brightness': value as number,
      }, { cache: { update: { 'LightDetails': 'delete' } } })
        .then(() => {
          resolve;
        })
        .catch(() => {
          reject(new Error('Failed to set lights brightness characteristic for spa device'));
        });
    });
  }

  ////////////////////////
  // FUNCTION - GETLOCK //
  ////////////////////////
  async getLock(): Promise<number> {
    // getLock - Get the lock state for the keypad lock
    // Returns - number (0 - Off, 1 - On)
    return new Promise<number>((resolve, reject) => {
      this.platform.spanetapi.get('/Settings/Lock/' + this.platform.spaId, { id: 'Lock' })
        .then((response) => {
          this.platform.log.debug('Get Characteristic Lock State ->', response.data as number === 1 ? 0 : 1);
          resolve(response.data as number === 1 ? 0 : 1);
        })
        .catch(() => {
          reject(new Error('Failed to get lock on characteristic for spa device'));
        });
    });
  }

  ////////////////////////
  // FUNCTION - SETLOCK //
  ////////////////////////
  async setLock(value: CharacteristicValue): Promise<null> {
    // setLock - Set the lock state for the keypad lock
    // Input - number (0 - Off, 1 - On)
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.put('/Settings/Lock/' + this.platform.spaId, {
        'lockMode': value as number === 0 ? 1 : 2,    
      }, { cache: { update: { 'Lock': 'delete' } } })
        .then(() => {
          resolve;
        })
        .catch(() => {
          reject(new Error('Failed to set lock on characteristic for spa device'));
        });
    });
  }
}
