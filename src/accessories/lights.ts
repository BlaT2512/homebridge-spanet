import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { SpaNETHomebridgePlatform, Endpoint } from '../platform';

/**
 * SpaNET Lights Accessory
 * Exposes the spa lights accessory to Homebridge and handle on/off state, brightness and colour
 */
export class SpaNETLightsAccessory {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private service: Service;
  private hue = 0;
  private saturation = 0;
  private brightness = 100;
  private spaColourNames = ['green', 'blue', 'teal', 'purple', 'red', 'pink', 'white', 'lime', 'orange'];
  private spaColours = [
    [140, 50, 60],
    [216, 73, 65],
    [176, 50, 70],
    [233, 30, 82],
    [352, 67, 80],
    [330, 70, 82],
    [0, 0, 100],
    [75, 58, 96],
    [22, 64, 92],
  ];

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
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);
    this.service.getCharacteristic(this.platform.Characteristic.On) // Whether the lights are on
      .onGet(async () => new Promise<boolean>((resolve, reject) => {
        this.platform.spaData(Endpoint.lights)
          .then(response => {
            this.platform.log.debug('Get Characteristic Lights On ->', response.lightOn as boolean);
            resolve(response.lightOn as boolean);
          })
          .catch(() => reject(new Error('Failed to get lights on characteristic for spa device')));
      }))
      .onSet(async value => new Promise((resolve, reject) => {
        this.platform.spanetapi.put('/Lights/SetLightStatus/' + this.accessory.context.device.apiId, {
          'deviceId': this.platform.spaId,
          'on': value as boolean,
        })
          .then(() => {
            this.service.updateCharacteristic(this.platform.Characteristic.On, value);
            this.platform.log.debug('Set Characteristic Lights On ->', value);
            resolve();
          })
          .catch(() => reject(new Error('Failed to set lights on characteristic for spa device')));
      }));

    /*this.service.getCharacteristic(this.platform.Characteristic.Hue) // Hue of the lights
      .onGet(() => new Promise<number>((resolve, reject) => {
        this.platform.spaData(Endpoint.lights)
          .then(response => {
            this.platform.log.debug('Get Characteristic Lights Colour ->', response.lightColour);
            this.hue = this.spaColours[this.spaColourNames.indexOf(response.lightColour)][0];
            this.saturation = this.spaColours[this.spaColourNames.indexOf(response.lightColour)][1];
            resolve(this.hue);
          })
          .catch(() => reject(new Error('Failed to get lights brightness characteristic for spa device')));
      }))
      .onSet(value => {
        this.platform.log.info('HUE: ' + value);
        this.hue = value as number;
        this.debounce(this.setLights.bind(this));
      });

    this.service.getCharacteristic(this.platform.Characteristic.Saturation) // Saturation of the lights
      .onGet(() => new Promise<number>((resolve, reject) => {
        this.platform.spaData(Endpoint.lights)
          .then(response => {
            this.platform.log.debug('Get Characteristic Lights Colour ->', response.lightColour);
            this.hue = this.spaColours[this.spaColourNames.indexOf(response.lightColour)][0];
            this.saturation = this.spaColours[this.spaColourNames.indexOf(response.lightColour)][1];
            resolve(this.saturation);
          })
          .catch(() => reject(new Error('Failed to get lights brightness characteristic for spa device')));
      }))
      .onSet(value => {
        this.platform.log.info('SATURATION: ' + value);
        this.saturation = value as number;
        this.debounce(this.setLights.bind(this));
      });*/

    this.service.getCharacteristic(this.platform.Characteristic.Brightness) // Brightness of the lights
      .onGet(() => new Promise<number>((resolve, reject) => {
        this.platform.spaData(Endpoint.lights)
          .then(response => {
            this.platform.log.debug('Get Characteristic Lights Brightness ->', response.lightBrightness as number * 20);
            this.brightness = response.lightBrightness as number * 20;
            resolve(response.lightBrightness as number * 20);
          })
          .catch(() => reject(new Error('Failed to get lights brightness characteristic for spa device')));
      }))
      .onSet(value => {
        this.brightness = value as number;
        this.debounce(this.setBrightness.bind(this, this.brightness));
        //this.debounce(this.setLights.bind(this));
      })
      .setProps({minValue: 0, maxValue: 100, minStep: 20});
  }

  debounce(func: (...args: any[]) => void, timeout = 500) {
    clearTimeout(this.debounceTimers.get(func.name));
    this.debounceTimers.set(
      func.name,
      setTimeout(() => func.apply(this), timeout)
    );
  }

  /**
   * setLights - Set the colour and brightness for the spa lights
   * @returns {Promise}
   */
  async setLights(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setBrightness(this.brightness)
        .then(() => {
          resolve();
          /*const colourIndex = this.findClosestColour([this.hue, this.saturation, this.brightness], this.spaColours);
          this.platform.spanetapi.put('/Lights/SetLightColour/' + this.accessory.context.device.apiId, {
            'deviceId': this.platform.spaId,
            'colour': this.spaColourNames[colourIndex],
          })
            .then(() => {
              this.service.updateCharacteristic(this.platform.Characteristic.Hue, this.spaColours[colourIndex][0]);
              this.service.updateCharacteristic(this.platform.Characteristic.Saturation, this.spaColours[colourIndex][1]);
              this.platform.log.debug('Set Characteristic Lights Colour ->', this.spaColourNames[colourIndex]);
              resolve();
            })
            .catch(() => reject(new Error('Failed to set lights colour characteristic for spa device')));*/
        })
        .catch(e => reject(e));
    });
  }

  /**
   * setBrightness - Set the brightness for the spa lights
   * @param {number} value - The target lights brightness (0-100 %)
   * @returns {Promise}
   */
  async setBrightness(value: CharacteristicValue): Promise<void> {
    const roundedValue = Math.ceil(value as number / 20) * 20;
    this.platform.log.debug('Rounding brightness', value, 'to', roundedValue / 20);
    return new Promise((resolve, reject) => {
      if (roundedValue > 0) {
        this.platform.spanetapi.put('/Lights/SetLightBrightness/' + this.accessory.context.device.apiId, {
          'deviceId': this.platform.spaId,
          'brightness': roundedValue / 20,
        })
          .then(() => {
            //this.service.updateCharacteristic(this.platform.Characteristic.On, true);
            this.service.updateCharacteristic(this.platform.Characteristic.Brightness, roundedValue);
            this.platform.log.debug('Set Characteristic Lights Brightness ->', roundedValue);
            resolve();
          })
          .catch(() => reject(new Error('Failed to set lights brightness characteristic for spa device')));
      } else {
        resolve();
      }
    });
  }

  /**
   * Find closest colour from array of discrete colours to given HSB colour
   * @param {number[]} targetColour - The target HSB colour
   * @param {number[][]} colourArray - The array of HSB colours to match against
   * @returns {number} - The index of the closest colour in the array
   */
  findClosestColour(targetColour: number[], colourArray: number[][]): number {
    let minDistance = Infinity;
    let closestColourIndex = -1;

    for (let i = 0; i < colourArray.length; i++) {
      const deltaHue = Math.abs(targetColour[0] - colourArray[i][0]);
      const deltaSaturation = Math.abs(targetColour[1] - colourArray[i][1]);
      const deltaBrightness = Math.abs(targetColour[2] - colourArray[i][2]);
      const distance = Math.sqrt(deltaHue ** 2 + deltaSaturation ** 2 + deltaBrightness ** 2);
      if (distance < minDistance) {
        minDistance = distance;
        closestColourIndex = i;
      }
    }

    return closestColourIndex;
  }
}
