import axios from 'axios';
import axiosRateLimit from 'axios-rate-limit';
import { setupCache, buildMemoryStorage } from 'axios-cache-interceptor';
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SpaNETPlatformAccessory } from './platformAccessory';

/////////////////////////
// HOMEBRIDGE PLATFORM //
/////////////////////////
export class SpaNETHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];

  constructor (
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.userdeviceid = this.uuid();
      // Check if the spa is linked and register it's accessories
      this.registerDevices();
    });
  }

  baseapi = axios.create ({
    baseURL: 'https://app.spanet.net.au/api',
    timeout: 2000,
    headers: {'User-Agent': 'SpaNET/2 CFNetwork/1465.1 Darwin/23.0.0'},
    validateStatus: function (status) {
      return status === 200; 
    },
  });

  spanetapi = setupCache(axiosRateLimit(this.baseapi, { maxRPS: 3 }), {
    headerInterpreter: () => {
      return 6;
    },
    storage: buildMemoryStorage ( false, 6000, false ),
  });

  accessToken = '';
  accessTokenExpiry = 0;
  refreshToken = '';
  spaId = 0;
  userdeviceid = '';

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  //////////////////////////
  // REGISTER ACCESSORIES //
  //////////////////////////
  registerDevices() {

    // Parse through user config and check that the user and selected spa are valid
    if (this.config.email !== '' && this.config.password !== '' && this.config.spaName !== '') {

      // First, login to API with their email and password to see if the user exists, otherwise cancel registration
      this.spanetapi.post('/Login/Authenticate', {
        'email': this.config.email,
        'password': this.config.password,
        'userDeviceId': this.userdeviceid,
        'language': 'en',
      })
        .then((response) => {
          const accessToken = response.data.access_token;
          const accessTokenExpiry = this.tokenExpiry(accessToken);
          const refreshToken = response.data.refresh_token;
          this.spanetapi.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken;
  
          // Now that the user has successfully logged in, check that the spa that is set exists on their account
          this.spanetapi.get('/Devices')
            .then((response) => {
              if (response.data.devices.length > 0) {
                let spaFound = false;
                for (const spa of response.data.devices) {
                  if (spa.name === this.config.spaName) {
                    spaFound = true;
                    this.accessToken = accessToken;
                    this.accessTokenExpiry = accessTokenExpiry;
                    this.refreshToken = refreshToken;
                    this.spaId = spa.id;
                  }
                }

                if (spaFound) {
                  this.spaConnect();
                } else {
                  this.log.error('Error: The specified spa does not exist for the SpaLINK account. Please log in with a different '
                               + 'account or click on the setting button below the homebridge-spanet module to change it.');
                  this.log.warn('Warning: SpaNET plugin inactive. Please address specified '
                              + 'issue and reboot Homebridge to re-attempt setup.');
                }

              } else {
                this.log.error('Error: No spa\'s are linked to the specified SpaLINK account. Please '
                             + 'log in with a different account or link a spa in the SpaLINK app.');
                this.log.warn('Warning: SpaNET plugin inactive. Please address specified '
                            + 'issue and reboot Homebridge to re-attempt setup.');
              }
            })
            .catch((error) => {
              this.log.error('Error: Unable to obtain spa details from member, but login was successful. Please '
                           + 'check your network connection, or open an issue on GitHub (unexpected).');
              this.log.error(error);
              this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
            });

        })
        .catch(() => {
          this.log.error('Error: Unable to login with details provided. Please ensure that you have the correct email and passsword.');
          this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
        });

    } else {
      this.log.error('Error: Email, password and/or spa name not provided. Please click the '
                   + 'settings button below the homebridge-spanet module to configure.');
      this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
    }
  }

  spaConnect() {
    this.log.info('Logged in successfully, fetch data for ' + this.config.spaName + '...');

    // Request spa pumps and blower details
    this.spanetapi.get('/PumpsAndBlower/Get/' + this.spaId, { id: 'PumpsAndBlower' })
      .then((response) => {
        const blowerId = response.data.pumpAndBlower.blower.id;
        const pumps = response.data.pumpAndBlower.pumps;

        // Request spa lights details
        this.spanetapi.get('/Lights/GetLightDetails/' + this.spaId, { id: 'LightDetails' })
          .then((response) => {
            const lightId = response.data.lightId;

            // Request spa sleep timers details
            this.spanetapi.get('/SleepTimers/' + this.spaId, { id: 'SleepTimers' })
              .then((response) => {
                const sleepTimers = response.data;
    
                // Register/deregister each device for components of spa
                const spaDevices = [
                  {
                    deviceId: 'spanet.pump.blower',
                    displayName: 'Blower',
                    deviceClass: 'Blower',
                    apiId: blowerId,
                  },
                  {
                    deviceId: 'spanet.light.lights',
                    displayName: 'Lights',
                    deviceClass: 'Lights',
                    apiId: lightId,
                  },
                  {
                    deviceId: 'spanet.lockmechanism.keypadlock',
                    displayName: 'Lock',
                    deviceClass: 'Lock',
                  },
                  {
                    deviceId: 'spanet.controlswitch.sanitise',
                    displayName: 'Clean',
                    deviceClass: 'SanitiseSwitch',
                  },
                  {
                    deviceId: 'spanet.controlswitch.operationmode',
                    displayName: 'Operation Mode',
                    deviceClass: 'ModeSwitch',
                  },
                  {
                    deviceId: 'spanet.controlswitch.powersave',
                    displayName: 'Power Save',
                    deviceClass: 'PowerSwitch',
                  },
                ];
    
                for (const pump of pumps) {
                  if (pump.pumpNumber === -1) {
                    spaDevices.push ({
                      deviceId: 'spanet.thermostat.heaterpump',
                      displayName: 'Heater',
                      deviceClass: 'Thermostat',
                      apiId: pump.id,
                    });
                  } else {
                    spaDevices.push ({
                      deviceId: 'spanet.pump.pump' + pump.pumpNumber.toString(),
                      displayName: 'Jet ' + pump.pumpNumber.toString(),
                      deviceClass: 'Valve',
                      apiId: pump.id,
                    });
                  }
                }
    
                for (const sleepTimer of sleepTimers) {
                  spaDevices.push ({
                    deviceId: 'spanet.controlswitch.sleeptimer' + sleepTimer.timerNumber.toString(),
                    displayName: 'Sleep Timer ' + sleepTimer.timerNumber.toString(),
                    deviceClass: 'SleepSwitch',
                    apiId: sleepTimer.id,
                  });
                }
    
                // Repeat for each device in the list
                for (const device of spaDevices) {
      
                  // Check if it already exists
                  const uuid = this.api.hap.uuid.generate(device.deviceId);
                  const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      
                  if (existingAccessory) {
                    // Accessory already exists
                    // Update accessory cache
                    existingAccessory.context.device = device;
                    this.api.updatePlatformAccessories([existingAccessory]);
    
                    // Create accessory handler from platformAccessory.ts 
                    new SpaNETPlatformAccessory(this, existingAccessory);
      
                  } else {
                    // Accessory doesn't exist, create new accessory
                    const accessory = new this.api.platformAccessory(device.displayName, uuid);
      
                    // Store copy of the device object and data in the accessory context
                    accessory.context.device = device;
      
                    // Create handler for the accessory from platformAccessory.ts  
                    new SpaNETPlatformAccessory(this, accessory);
                    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                  }
                }
              })
              .catch((error) => {
                this.log.error('Error: Unable to obtain spa sleep timers details, but login was successful. Please '
                             + 'check your network connection, or open an issue on GitHub (unexpected).');
                this.log.error(error);
                this.log.warn('Warning: SpaNET plugin inactive. Please address specified '
                            + 'issue and reboot Homebridge to re-attempt setup.');
              });

          })
          .catch((error) => {
            this.log.error('Error: Unable to obtain spa lights details, but login was successful. Please '
                         + 'check your network connection, or open an issue on GitHub (unexpected).');
            this.log.error(error);
            this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
          });

      })
      .catch((error) => {
        this.log.error('Error: Unable to obtain spa jets and blower details, but login was successful. '
                     + 'Please check your network connection, or open an issue on GitHub (unexpected).');
        this.log.error(error);
        this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
      });
  }

  tokenExpiry(token): number {
    const payloadBase64 = token.split('.')[1];
    const decodedJson = Buffer.from(payloadBase64, 'base64').toString();
    const decoded = JSON.parse(decodedJson);
    const exp = decoded.exp;
    return exp;
  }

  uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
