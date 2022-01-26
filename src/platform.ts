/* eslint-disable max-len */
import request = require('request');
import net = require('net');
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

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // Check if the spa is linked and register it's accessories
      this.registerDevices();
    });
  }

  globalSpaVars: Array<string> = [];

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
    if (this.config.username !== '' && this.config.password !== '' && this.config.spaName !== '') {

      // First, login to API with their username and encrypted password key to see if the user exists, otherwise cancel registration
      const loginParams = {
        uri: 'https://api.spanet.net.au/api/MemberLogin',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        json: {
          'login': this.config.username,
          'api_key': '4a483b9a-8f02-4e46-8bfa-0cf5732dbbd5',
          'password': this.config.password,
        },
      };

      request(loginParams, (error, response, body) => {
        if (!error && response.statusCode === 200 && body['success']) {
          
          const memberId = body['data']['id_member'];
          const sessionId = body['data']['id_session'];

          // Now that the user has successfully logged in, check that the spa that is set exists on their account
          const spaParams = {
            uri: 'https://api.spanet.net.au/api/membersockets?id_member=' + memberId + '&id_session=' + sessionId,
            method: 'GET',
          };

          request(spaParams, (error, response, body) => {
            if (!error && response.statusCode === 200 && JSON.parse(body)['success']) {
              
              // Parse through the list of spa sockets and check that the spa specified in settings exists
              const bodyJSON = JSON.parse(body);

              if (bodyJSON['sockets'][0] !== undefined){

                let spaFound = false;
                for(const result of bodyJSON['sockets']){
                  // Check whether the name matches the spa name specified by the user
                  if (result['name'] === this.config.spaName){

                    // This is the correct spa that the user has chosen, test a connection to it's websocket
                    spaFound = true;
                    const spaIP = result['spaurl'].slice(0, -5);
                    this.globalSpaVars = [result['name'], spaIP, result['id_sockets'], result['id_member']];
                    
                  }
                }

                if (spaFound === false){
                  this.log.error('Error: The specified spa does not exist for the SpaLINK account. Please log in with a different account or click on the setting button below the homebridge-spanet module to change it.');
                  this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
                }
                this.spaConnect();

              } else {
                this.log.error('Error: No spa\'s are linked to the specified SpaLINK account. Please log in with a different account or link a spa in the SpaLINK app.');
                this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
              }

            } else {
              this.log.error('Error: Unable to obtain spa details from member, but login was successful. Please check your network connection, or open an issue on GitHub (unexpected).');
              this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
            }
          });

        } else {
          this.log.error('Error: Unable to login with details provided. Please ensure that you have the correct username and encrypted password (see Github for details).');
          this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
        }
      });

    } else {
      this.log.error('Error: Username, password and/or spa name not provided. Please click the settings button below the homebridge-spanet module to configure.');
      this.log.warn('Warning: SpaNET plugin inactive. Please address specified issue and reboot Homebridge to re-attempt setup.');
    }
  }

  spaConnect() {
    this.log.info('Attempting to connect to... ' + this.globalSpaVars[0]);
    const client = new net.Socket();
    client.connect(9090, this.globalSpaVars[1], () => {
      //client.write('<connect--' + this.globalSpaVars[2] + '--' + this.globalSpaVars[3] + '>');
      this.log.info('Successfully connected to spa ' + this.globalSpaVars[0]);

      // Register/deregister each device for components of spa
      const spaDevices = [
        {
          deviceId: 'spanet.thermostat.heaterpump',
          displayName: 'Heater',
          deviceClass: 'Thermostat',
        },
        {
          deviceId: 'spanet.pump.pump2',
          displayName: 'Jet 1',
          deviceClass: 'ToggleSwitch',
          command: 'S23:',
          readBit: 20,
          readLine: 4,
          readOff: 0,
        },
        {
          deviceId: 'spanet.pump.pump3',
          displayName: 'Jet 2',
          deviceClass: 'ToggleSwitch',
          command: 'S24:',
          readBit: 21,
          readLine: 4,
          readOff: 0,
        },
        {
          deviceId: 'spanet.pump.blower',
          displayName: 'Blower',
          deviceClass: 'Blower',
        },
        {
          deviceId: 'spanet.light.lights',
          displayName: 'Lights',
          deviceClass: 'Lights',
        },
        {
          deviceId: 'spanet.controlswitch.sleeptimer',
          displayName: 'Sleep',
          deviceClass: 'ToggleSwitch',
          command: 'W67:',
          readBit: 14,
          readLine: 5,
          readOff: 128,
        },
        {
          deviceId: 'spanet.lockmechanism.keypadlock',
          displayName: 'Lock',
          deviceClass: 'Lock',
        },
        {
          deviceId: 'spanet.controlswitch.sanitise',
          displayName: 'Clean',
          deviceClass: 'ToggleSwitch',
        },
        {
          deviceId: 'spanet.controlswitch.normalmode',
          displayName: 'Normal',
          deviceClass: 'ModeSwitch',
          command: 0,
        },
        {
          deviceId: 'spanet.controlswitch.econmode',
          displayName: 'Economy',
          deviceClass: 'ModeSwitch',
          command: 1,
        },
        {
          deviceId: 'spanet.controlswitch.awaymode',
          displayName: 'Away',
          deviceClass: 'ModeSwitch',
          command: 2,
        },
        {
          deviceId: 'spanet.controlswitch.weekmode',
          displayName: 'Week',
          deviceClass: 'ModeSwitch',
          command: 3,
        },
        {
          deviceId: 'spanet.controlswitch.psoff',
          displayName: 'Power Save Off',
          deviceClass: 'PowerSwitch',
          command: 0,
        },
        {
          deviceId: 'spanet.controlswitch.pslow',
          displayName: 'Power Save Low',
          deviceClass: 'PowerSwitch',
          command: 1,
        },
        {
          deviceId: 'spanet.controlswitch.pshigh',
          displayName: 'Power Save High',
          deviceClass: 'PowerSwitch',
          command: 2,
        },
      ];

      // Repeat for each device in the list
      for (const device of spaDevices) {

        // Check if it already exists
        const uuid = this.api.hap.uuid.generate(device.deviceId);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          // Accessory already exists
          // Update accessory cache
          existingAccessory.context.spaName = this.globalSpaVars[0];
          existingAccessory.context.spaIp = this.globalSpaVars[1];
          existingAccessory.context.spaSocket = this.globalSpaVars[2];
          existingAccessory.context.spaMember = this.globalSpaVars[3];
          this.api.updatePlatformAccessories([existingAccessory]);
          // Create accessory handler from platformAccessory.ts 
          new SpaNETPlatformAccessory(this, existingAccessory);

        } else {
          // Accessory doesn't exist, create new accessory
          const accessory = new this.api.platformAccessory(device.displayName, uuid);

          // Store copy of the device object and data in the accessory context
          accessory.context.device = device;
          accessory.context.spaName = this.globalSpaVars[0];
          accessory.context.spaIp = this.globalSpaVars[1];
          accessory.context.spaSocket = this.globalSpaVars[2];
          accessory.context.spaMember = this.globalSpaVars[3];
          if (device.deviceClass.includes('Switch')) {
            accessory.context.spaCommand = device.command;
          }
          if (device.deviceClass === 'ToggleSwitch') {
            accessory.context.spaReadLine = device.readLine;
            accessory.context.spaReadBit = device.readBit;
            accessory.context.spaReadOff = device.readOff;
          }

          // Create handler for the accessory from platformAccessory.ts  
          new SpaNETPlatformAccessory(this, accessory);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }
    });
  }
}
