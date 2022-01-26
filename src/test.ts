import net = require('net');
/*  
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
  async setTargLock(value, callback) {
    // setTargLock - Set the target lock state for the keypad lock
    // Input - value as string (string)
      
    // Connect to socket and write data
    await new Promise<void>((resolve) => {
      const client = new net.Socket();
      client.connect(9090, this.accessory.context.spaIp, () => {
        client.write('<connect--' + this.accessory.context.spaSocket + '--' + this.accessory.context.spaMember + '>');
      });
      client.on('data', () => {
        // Send command to set lock state
        if (value === this.platform.Characteristic.LockTargetState.UNSECURED){
          client.write('S21:0\n');
        } else {
          client.write('S21:2\n');
        }
        client.destroy();
        resolve();
      });
    });
    this.platform.log.debug('Set Characteristic LockTargState ->', value);
    callback(null);
  }
*/
const client = new net.Socket();

function setupSocket() {
  client.connect(9090, '54.79.54.66', () => {
    client.write('<connect--7889--5966>');
  });

  client.on('data', () => {
    console.log('DATA RECIEVED');
  });
}

function requestData() {
  client.write('RF\n');
}

setupSocket();
console.log('FINISHED FIRST');
requestData();