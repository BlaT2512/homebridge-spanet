import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { SpaNETHomebridgePlatform, Endpoint } from './platform';

/**
 * SpaNET Platform Accessory
 * Exposes all the services for the spa elements to Homebridge and controls them
 */
export class SpaNETPlatformAccessory {
  private service: Array<Service>;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor (
    private readonly platform: SpaNETHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'SpaNET')
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
          .setProps({minValue: 5, maxValue: 41, minStep: 0.2});
        
        this.service[0].getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits) // Temperature units of the heater
          .onGet(() => this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS)
          .setProps({minValue: 0, maxValue: 0});
        break;
      
      case 'Valve': // Jet
        this.service = [
          this.accessory.getService(this.platform.Service.Valve) ||
          this.accessory.addService(this.platform.Service.Valve),
        ];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.Active) // Whether the jet is on
          .onGet(this.getValve.bind(this))
          .onSet(this.setValve.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.InUse) // Whether the jet is on
          .onGet(this.getValve.bind(this));
        
        this.service[0].getCharacteristic(this.platform.Characteristic.ValveType) // Type of valve this is
          .onGet(() => this.platform.Characteristic.ValveType.SHOWER_HEAD);
        
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
          .onSet(value => {this.debounce(this.setBlowerSpeed.bind(this, value));})
          .setProps({minValue: 0, maxValue: 100, minStep: 20});
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

      case 'Sanitise': // Valve
        this.service = [
          this.accessory.getService(this.platform.Service.Valve) ||
          this.accessory.addService(this.platform.Service.Valve),
        ];
        this.service[0].setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
        this.service[0].getCharacteristic(this.platform.Characteristic.Active) // Whether the sanitise cycle is on
          .onGet(this.getOn.bind(this))
          .onSet(this.setOn.bind(this));
      
        this.service[0].getCharacteristic(this.platform.Characteristic.InUse) // Whether the sanitise cycle is on
          .onGet(this.getOn.bind(this));
      
        this.service[0].getCharacteristic(this.platform.Characteristic.ValveType) // Type of valve this is
          .onGet(() => this.platform.Characteristic.ValveType.SHOWER_HEAD);
      
        this.service[0].getCharacteristic(this.platform.Characteristic.RemainingDuration) // How long remaining for sanitise cycle
          .onGet(this.getSanitiseRemaining.bind(this))
          .setProps({minValue: 0, maxValue: 1200, minStep: 1});
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
          .onGet(async () => new Promise<boolean>((resolve, reject) => {
            this.platform.spaData(Endpoint.information)
              .then(response => {
                const opermode = response.information.settingsSummary.operationMode as string;
                this.platform.log.debug('Get Characteristic Operation Mode ->', opermode);
                resolve(opermode === 'NORM');  
              })
              .catch(() => reject(new Error('Failed to get operation mode characteristic for spa device')));
          }))
          .onSet(async value => new Promise((resolve, reject) => {
            if (!value as boolean) {
              this.service[0].updateCharacteristic(this.platform.Characteristic.On, true);
              this.platform.log.debug('Set Characteristic Operation Mode ->', false);
              resolve();
        
            } else {
              this.platform.spanetapi.put('/Settings/OperationMode/' + this.platform.spaId, {
                'mode': 1,
              })
                .then(() => {
                  this.service[1].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.service[2].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.service[3].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.platform.log.debug('Set Characteristic Operation Mode ->', 1);
                  resolve();
                })
                .catch(() => reject(new Error('Failed to set operation mode characteristic for spa device')));
            }
          }));
        this.service[1].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .onGet(async () => new Promise<boolean>((resolve, reject) => {
            this.platform.spaData(Endpoint.information)
              .then(response => {
                const opermode = response.information.settingsSummary.operationMode as string;
                this.platform.log.debug('Get Characteristic Operation Mode ->', opermode);
                resolve(opermode === 'ECON');  
              })
              .catch(() => reject(new Error('Failed to get operation mode characteristic for spa device')));
          }))
          .onSet(async value => new Promise((resolve, reject) => {
            if (!value as boolean) {
              this.service[1].updateCharacteristic(this.platform.Characteristic.On, true);
              this.platform.log.debug('Set Characteristic Operation Mode ->', false);
              resolve();
        
            } else {
              this.platform.spanetapi.put('/Settings/OperationMode/' + this.platform.spaId, {
                'mode': 2,
              })
                .then(() => {
                  this.service[0].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.service[2].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.service[3].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.platform.log.debug('Set Characteristic Operation Mode ->', 2);
                  resolve();
                })
                .catch(() => reject(new Error('Failed to set operation mode characteristic for spa device')));
            }
          }));
        this.service[2].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .onGet(async () => new Promise<boolean>((resolve, reject) => {
            this.platform.spaData(Endpoint.information)
              .then(response => {
                const opermode = response.information.settingsSummary.operationMode as string;
                this.platform.log.debug('Get Characteristic Operation Mode ->', opermode);
                resolve(opermode === 'AWAY');  
              })
              .catch(() => reject(new Error('Failed to get operation mode characteristic for spa device')));
          }))
          .onSet(async value => new Promise((resolve, reject) => {
            if (!value as boolean) {
              this.service[2].updateCharacteristic(this.platform.Characteristic.On, true);
              this.platform.log.debug('Set Characteristic Operation Mode ->', false);
              resolve();
        
            } else {
              this.platform.spanetapi.put('/Settings/OperationMode/' + this.platform.spaId, {
                'mode': 3,
              })
                .then(() => {
                  this.service[0].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.service[1].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.service[3].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.platform.log.debug('Set Characteristic Operation Mode ->', 3);
                  resolve();
                })
                .catch(() => reject(new Error('Failed to set operation mode characteristic for spa device')));
            }
          }));
        this.service[3].getCharacteristic(this.platform.Characteristic.On) // Whether the switch is on
          .onGet(async () => new Promise<boolean>((resolve, reject) => {
            this.platform.spaData(Endpoint.information)
              .then(response => {
                const opermode = response.information.settingsSummary.operationMode as string;
                this.platform.log.debug('Get Characteristic Operation Mode ->', opermode);
                resolve(opermode === 'WEEK');  
              })
              .catch(() => reject(new Error('Failed to get operation mode characteristic for spa device')));
          }))
          .onSet(async value => new Promise((resolve, reject) => {
            if (!value as boolean) {
              this.service[3].updateCharacteristic(this.platform.Characteristic.On, true);
              this.platform.log.debug('Set Characteristic Operation Mode ->', false);
              resolve();
        
            } else {
              this.platform.spanetapi.put('/Settings/OperationMode/' + this.platform.spaId, {
                'mode': 4,
              })
                .then(() => {
                  this.service[0].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.service[1].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.service[2].updateCharacteristic(this.platform.Characteristic.On, false);
                  this.platform.log.debug('Set Characteristic Operation Mode ->', 4);
                  resolve();
                })
                .catch(() => reject(new Error('Failed to set operation mode characteristic for spa device')));
            }
          }));
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

  debounce(func: (...args: any[]) => void, timeout = 500) {
    clearTimeout(this.debounceTimers.get(func.name));
    this.debounceTimers.set(
      func.name,
      setTimeout(() => func.apply(this), timeout)
    );
  }

  /**
   * getOn - Check whether the switch or device is on/active
   * @returns {Promise<boolean>} - Whether the device is on/active
   */
  async getOn(): Promise<boolean> {
    switch (this.accessory.context.device.deviceClass) {
      case 'Blower': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spaData(Endpoint.pumps)
            .then(response => {
              this.platform.log.debug('Get Characteristic Blower On ->', response.blower.blowerStatus !== 'off');
              resolve(response.blower.blowerStatus !== 'off');
            })
            .catch(() => reject(new Error('Failed to get blower on characteristic for spa device')));
        });
      }
      case 'Lights': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spaData(Endpoint.lights)
            .then(response => {
              this.platform.log.debug('Get Characteristic Lights On ->', response.lightOn as boolean);
              resolve(response.lightOn as boolean);
            })
            .catch(() => reject(new Error('Failed to get lights on characteristic for spa device')));
        });
      }
      case 'PowerSwitch': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spaData(Endpoint.information)
            .then(response => {
              const mode = response.information.settingsSummary.powersaveTimer.mode as number;
              this.platform.log.debug('Get Characteristic Power Save On ->', mode > 1);
              resolve(mode > 1);
            })
            .catch(() => reject(new Error('Failed to get power save on characteristic for spa device')));
        });
      }
      case 'Sanitise': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spaData(Endpoint.dashboard)
            .then(response => {
              this.platform.log.debug('Get Characteristic Sanitise On ->', response.sanitiseOn as boolean);
              resolve(response.sanitiseOn as boolean);
            })
            .catch(() => reject(new Error('Failed to get sanitise on characteristic for spa device')));
        });
      }
      case 'SleepSwitch': {
        return new Promise<boolean>((resolve, reject) => {
          this.platform.spaData(Endpoint.information)
            .then(response => {
              for (const sleepTimer of response.information.settingsSummary.sleepTimers) {
                if (sleepTimer.id === this.accessory.context.device.apiId) {
                  this.platform.log.debug('Get Characteristic Sleep Timer On ->', sleepTimer.isEnabled as boolean);
                  resolve(sleepTimer.isEnabled as boolean);
                  return;
                }
              }
              reject(new Error('Failed to get sleep timer on characteristic for spa device'));
            })
            .catch(() => reject(new Error('Failed to get sleep timer on characteristic for spa device')));
        });
      }
      default: {
        throw new Error('Unknown device class requesting on characteristic for spa device');
      }
    }
  }

  /**
   * setOn - Sets the switch or device's on/active state
   * @param {boolean} value - Whether the device should be on/active
   * @returns {Promise}
   */
  async setOn(value: CharacteristicValue): Promise<void> {
    switch (this.accessory.context.device.deviceClass) {
      case 'Blower': {
        return new Promise((resolve, reject) => {
          this.platform.spaData(Endpoint.pumps)
            .then(response => {
              const blowerSpeed = response.blower.blowerVariableSpeed as number;
    
              this.platform.spanetapi.put('/PumpsAndBlower/SetBlower/' + this.accessory.context.device.apiId, {
                'deviceId': this.platform.spaId,
                'modeId': value as boolean ? 2 : 1,
                'speed': blowerSpeed,
              })
                .then(() => {
                  this.platform.log.debug('Set Characteristic Blower On ->', value);
                  resolve();
                })
                .catch(() => reject(new Error('Failed to set blower on characteristic for spa device')));
            })
            .catch(() => reject(new Error('Failed to set blower on characteristic for spa device')));
        });
      }
      case 'Lights': {
        return new Promise((resolve, reject) => {
          this.platform.spanetapi.put('/Lights/SetLightStatus/' + this.accessory.context.device.apiId, {
            'deviceId': this.platform.spaId,
            'on': value as boolean,
          })
            .then(() => {
              this.service[0].updateCharacteristic(this.platform.Characteristic.On, value);
              this.platform.log.debug('Set Characteristic Lights On ->', value);
              resolve();
            })
            .catch(() => reject(new Error('Failed to set lights on characteristic for spa device')));
        });
      }
      case 'PowerSwitch': {
        return new Promise((resolve, reject) => {
          this.platform.spanetapi.put('/Settings/PowerSave/' + this.platform.spaId, {
            'mode': value as boolean ? this.platform.config.highPowerSave ? 3 : 2 : 1,
          })
            .then(() => {
              this.platform.log.debug('Set Characteristic Power Save Mode ->', value ? this.platform.config.highPowerSave ? 3 : 2 : 1);
              resolve();
            })
            .catch(() => reject(new Error('Failed to set power save on characteristic for spa device')));
        });
      }
      case 'Sanitise': {
        return new Promise((resolve, reject) => {
          this.platform.spanetapi.put('/Settings/SanitiseStatus/' + this.platform.spaId, {
            'on': value as boolean,
          })
            .then (() => {
              this.service[0].updateCharacteristic(this.platform.Characteristic.Active, value ? 1 : 0);
              this.service[0].updateCharacteristic(this.platform.Characteristic.InUse, value ? 1 : 0);
              this.platform.log.debug('Set Characteristic Sanitise On ->', value);
              resolve();
            })
            .catch(() => reject(new Error('Failed to set sanitise on characteristic for spa device')));
        });
      }
      case 'SleepSwitch': {
        return new Promise((resolve, reject) => {
          this.platform.spaData(Endpoint.information)
            .then(response => {
              let found = false;
              for (const sleepTimer of response.information.settingsSummary.sleepTimers) {
                if (sleepTimer.id === this.accessory.context.device.apiId) {
                  found = true;
                  this.platform.spanetapi.put('/SleepTimers/' + this.accessory.context.device.apiId, {
                    'deviceId': this.platform.spaId,
                    'daysHex': sleepTimer.daysHex,
                    'isEnabled': value as boolean,
                  })
                    .then (() => {
                      this.platform.log.debug('Set Characteristic Sleep Timer On ->', value);
                      resolve();
                    })
                    .catch(error => reject(error));
                }
              }
              if (!found) {
                reject(new Error('Failed to set sleep timer on characteristic for spa device'));
              }
            })
            .catch(() => reject(new Error('Failed to set sleep timer on characteristic for spa device')));
        });
      }
      default: {
        throw new Error('Unknown device class setting on characteristic for spa device');
      }
    }
  }
  
  /**
   * getValve - Check whether jet is on or off
   * @returns {Promise<number>} - Whether the jet is on (1) or off (0)
   */
  async getValve(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.platform.spaData(Endpoint.pumps)
        .then(response => {
          const pumps = response.pumps;
          for (const pump of pumps) {
            if (pump.id === this.accessory.context.device.apiId) {
              this.platform.log.debug('Get Characteristic Jet On ->', pump.pumpStatus === 'on');
              resolve(pump.pumpStatus === 'on' ? 1 : 0);
              return;
            }
          }
          reject(new Error('Failed to get jet active characteristic for spa device'));
        })
        .catch(() => reject(new Error('Failed to get jet active characteristic for spa device')));
    });
  }

  /**
   * setValve - Sets jet on or off
   * @param {number} value - Whether the jet should be on (1) or off (0)
   * @returns {Promise}
   */
  async setValve(value: CharacteristicValue): Promise<void> {
    return new Promise((resolve, reject) => {
      this.platform.spaData(Endpoint.pumps)
        .then(response => {
          let pumpVariableSpeed = 0;
          const pumps = response.pumps;
          for (const pump of pumps) {
            if (pump.id === this.accessory.context.device.apiId) {
              pumpVariableSpeed = pump.pumpVariableSpeed as number;
            }
          }

          this.platform.spanetapi.put('/PumpsAndBlower/SetPump/' + this.accessory.context.device.apiId, {
            'deviceId': this.platform.spaId,
            'modeId': value === 1 ? 1 : 2,
            'pumpVariableSpeed': pumpVariableSpeed,
          })
            .then (() => {
              this.service[0].updateCharacteristic(this.platform.Characteristic.Active, value);
              this.service[0].updateCharacteristic(this.platform.Characteristic.InUse, value);
              this.platform.log.debug('Set Characteristic Jet On ->', value as number === 1);
              resolve();
            })
            .catch(() => reject(new Error('Failed to set jet active characteristic for spa device')));
        })
        .catch(() => reject(new Error('Failed to set jet active characteristic for spa device')));
    });
  }

  /**
   * getCurState - Check whether the heater is off, heating or cooling
   * @returns {Promise<number>} - Whether the heater is off (0), heating (1) or cooling (2)
   */
  async getCurState(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.platform.spaData(Endpoint.information)
        .then(response => {
          if (response.information.informationStatus.heater as string === '0') {
            this.platform.log.debug('Get Characteristic Current Heating State ->', 0);
            resolve(0);
  
          } else {
            // Heating if current temperature too low, cooling if current temperature too high
            this.platform.spaData(Endpoint.dashboard)
              .then(response => {
                this.platform.log.debug('Get Characteristic Current Heating State ->',
                  (response.setTemperature as number - response.currentTemperature as number >= 0) ? 1 : 2,
                );
                resolve((response.setTemperature as number - response.currentTemperature as number >= 0) ? 1 : 2);
              })
              .catch(() => reject(new Error('Failed to get current heater state characteristic for spa device')));
          }
        })
        .catch(() => reject(new Error('Failed to get current heater state characteristic for spa device')));
    });
  }

  /**
   * getTargState - Check whether the heater is set to off, heating, cooling or auto
   * @returns {Promise<number>} - Whether the heater is set to off (0), heating (1), cooling (2) or auto (3)
   */
  async getTargState(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.platform.spaData(Endpoint.information)
        .then(response => {
          const rawmode = response.information.settingsSummary.heatPumpMode as string;
          const mode = rawmode === '0' ? 3 : rawmode === '1' ? 1 : rawmode === '2' ? 2 : 0;
          this.platform.log.debug('Get Characteristic Target Heating State ->', mode);
          resolve(mode);
        })
        .catch(() => reject(new Error('Failed to get target heater state characteristic for spa device')));
    });
  }

  /**
   * setTargState - Set the heater mode to off, heat, cool or auto
   * @param {number} value - Whether the heater should be off (0), heating (1), cooling (2) or auto (3)
   * @returns {Promise}
   */
  async setTargState(value: CharacteristicValue): Promise<void> {
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.put('/Settings/SetHeatPumpMode/' + this.platform.spaId, {
        'mode': value === 0 ? 4 : value === 1 ? 2 : value === 2 ? 3 : 1,
      })
        .then (() => {
          this.service[0].updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, value);
          this.platform.log.debug('Set Characteristic Target Heating State ->', value);
          resolve();
        })
        .catch(() => reject(new Error('Failed to set target heater state characteristic for spa device')));
    });
  }

  /**
   * getCurTemp - Get the current actual water temperature
   * @returns {Promise<number>} - The current water temperature (-270.0 - 100.0 °C) 
   */
  async getCurTemp(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.platform.spaData(Endpoint.dashboard)
        .then(response => {
          this.platform.log.debug('Get Characteristic Current Temperature ->', response.currentTemperature as number / 10);
          resolve(response.currentTemperature as number / 10);
        })
        .catch(() => reject(new Error('Failed to get current temperature characteristic for spa device')));
    });
  }

  /**
   * getCurTemp - Get the set temperature for the spa water
   * @returns {Promise<number>} - The set water temperature (5.0 - 41.0 °C) 
   */
  async getTargTemp(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.platform.spaData(Endpoint.dashboard)
        .then(response => {
          this.platform.log.debug('Get Characteristic Target Temperature ->', response.setTemperature as number / 10);
          resolve(response.setTemperature as number / 10);
        })
        .catch(() => reject(new Error('Failed to get target temperature characteristic for spa device')));
    });
  }

  /**
   * setTargTemp - Set the temperature for the spa water
   * @param {number} value - The target water temperature (5.0 - 41.0 °C) 
   * @returns {Promise}
   */
  async setTargTemp(value: CharacteristicValue): Promise<void> {
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.put('/Dashboard/' + this.platform.spaId, {
        'temperature': value as number * 10,  
      })
        .then(() => {
          this.platform.log.debug('Set Characteristic Target Temperature ->', value);
          resolve();
        })
        .catch(() => reject(new Error('Failed to set target temperature characteristic for spa device')));
    });
  }

  /**
   * getTimeout - Get the timeout for the spa jets
   * @returns {Promise<number>} - The jets timeout duration (0-3600 seconds)
   */
  async getTimeout(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.platform.spaData(Endpoint.information)
        .then(response => {
          this.platform.log.debug('Get Characteristic Jet Timeout ->', parseInt(response.information.settingsSummary.pumpTimeOut)*60);
          resolve(parseInt(response.information.settingsSummary.pumpTimeOut) * 60);
        })
        .catch(() => reject(new Error('Failed to get jet timeout characteristic for spa device')));
    });
  }

  /**
   * setTimeout - Set the timeout for the spa jets
   * @param {number} value - The target jets timeout duration (0-3600 seconds)
   * @returns {Promise}
   */
  async setTimeout(value: CharacteristicValue): Promise<void> {
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.put('/Settings/Timeout/' + this.platform.spaId, {
        'timeout': value as number / 60, 
      })
        .then(() => {
          this.platform.log.debug('Set Characteristic Jet Timeout ->', value);
          resolve();
        })
        .catch(() => reject(new Error('Failed to set jet active characteristic for spa device')));
    });
  }

  /**
   * getBlowerSpeed - Get the speed for the spa blower
   * @returns {Promise<number>} - The blower speed (0-100 %)
   */
  async getBlowerSpeed(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.platform.spaData(Endpoint.pumps)
        .then(response => {
          this.platform.log.debug('Get Characteristic Blower Speed ->', response.blower.blowerVariableSpeed as number * 20);
          resolve(response.blower.blowerVariableSpeed as number * 20);
        })
        .catch(() => reject(new Error('Failed to get blower speed characteristic for spa device')));
    });
  }

  /**
   * setBlowerSpeed - Set the speed for the spa blower
   * @param {number} value - The target blower speed (0-100 %)
   * @returns {Promise}
   */
  async setBlowerSpeed(value: CharacteristicValue): Promise<void> {
    const roundedValue = Math.ceil(value as number / 20) * 20;
    return new Promise((resolve, reject) => {
      if (roundedValue > 0) {
        this.platform.spanetapi.put('/PumpsAndBlower/SetBlower/' + this.accessory.context.device.apiId, {
          'deviceId': this.platform.spaId,
          'modeId': 2,
          'speed': roundedValue / 20,
        })
          .then(() => {
            this.service[0].updateCharacteristic(this.platform.Characteristic.On, true);
            this.service[0].updateCharacteristic(this.platform.Characteristic.RotationSpeed, roundedValue);
            this.platform.log.debug('Set Characteristic Blower Speed ->', roundedValue);
            resolve();
          })
          .catch(() => reject(new Error('Failed to set blower speed characteristic for spa device')));
      } else {
        resolve();
      }
    });
  }

  /**
   * getLock - Check whether the keypad lock is on or off
   * @returns {Promise<number>} - Whether the keypad lock is on (1) or off (0)
   */
  async getLock(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.platform.spaData(Endpoint.information)
        .then(response => {
          this.platform.log.debug('Get Characteristic Lock State ->', response.information.informationStatus.keylock === '1');
          resolve(response.information.informationStatus.keylock === '1' ? 1 : 0);
        })
        .catch(() => reject(new Error('Failed to get lock on characteristic for spa device')));
    });
  }

  /**
   * getLock - Sets the keypad lock state to on or off
   * @param {number} value - Whether the keypad lock should be on (1) or off (0)
   * @returns {Promise}
   */
  async setLock(value: CharacteristicValue): Promise<void> {
    return new Promise((resolve, reject) => {
      this.platform.spanetapi.put('/Settings/Lock/' + this.platform.spaId, {
        'lockMode': value as number === 0 ? 1 : this.platform.config.fullLock ? 3 : 2,
      })
        .then (() => {
          this.service[0].updateCharacteristic(this.platform.Characteristic.LockCurrentState, value);
          this.service[0].updateCharacteristic(this.platform.Characteristic.LockTargetState, value);
          this.platform.log.debug('Set Characteristic Lock State ->', value as number === 1);
          resolve();
        })
        .catch(() => reject(new Error('Failed to set lock on characteristic for spa device')));
    });
  }

  /**
   * getSanitiseRemaining - Get the time remaining for the sanitise cycle
   * @returns {Promise<number>} - Time remaining for the sanitise cycle (0-1200 seconds), or 0 if the spa is not sanitising
   */
  async getSanitiseRemaining(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.platform.spaData(Endpoint.dashboard)
        .then(response => {
          let found = false;
          for (const item of response.statusList) {
            if (item.includes('Sanitise Cycle: ')) {
              found = true;
              const rawTime = item.replace('Sanitise Cycle: ', '').split(':');
              this.platform.log.debug('Get Characteristic Sanitise Remaining ->', Number(rawTime[0])*60 + Number(rawTime[1]));
              resolve(Number(rawTime[0])*60 + Number(rawTime[1]));
            }
          }
          if (!found) {
            resolve(0);
          }
        })
        .catch(() => reject(new Error('Failed to get lock on characteristic for spa device')));
    });
  }
}
