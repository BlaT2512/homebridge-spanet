<p align="center">
  <img src="https://raw.githubusercontent.com/homebridge/branding/6ef3a1685e79f79a2ecdcc83824e53775ec0475d/logos/homebridge-wordmark-logo-horizontal.svg" width="500">
</p>

# homebridge-spanet
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
![npm](https://img.shields.io/npm/v/homebridge-spanet)
![npm](https://img.shields.io/npm/dw/homebridge-spanet)

Homebridge SpaNET is a [Homebridge](https://github.com/homebridge/homebridge) plugin for controlling Australian/NZ spas with a SpaNET WiFi module. Spas that can be controlled with the SpaNET SmartLink app can be used. The plugin for Homebridge allows Homekit integration to control your spa, allowing you to integrate it into your smart home and control via routines/voice commands or however you like.

# Installation
Please ensure you are running the latest version of Homebridge (heres how to [install](https://github.com/homebridge/homebridge/wiki) if you haven't already). To install this plugin, run the following command on your Homebridge hosts command line/terminal application:
```
npm i -g homebridge-spanet
```
NOTE: For best performance, and due to the number of accessories this device exposes it is recommended you run this plugin on a child bridge (Homebridge Web Interface > Plugins > homebridge-spanet > Bridge Settings).

This also makes it easy to add the bridge in the Home app and create a room for the Spa, making all the spa accessories in their own room.

# Setup
Configure the plugin in Homebridge Web Interface > Plugins > homebridge-spanet > Settings

Email: The email you use to access the SmartLink app

Password: Your SmartLink app account password

Spa Name: The name of the spa you want to expose. At this time you can only expose one spa, support for more may come in a later release.

# Features
Here is the things you can control using this plugin through HomeKit:
* See the temperature of the spa and set a temperature for it to heat/cool to
* Turn on and off the spa lights (the lights will use the last set mode) and change the brightness - colour coming soon
* Turn on and off the blower (variable mode) and change the speed
* Turn on and off any jets on the spa and set the jet timeout
* Turn on and off clean cycle for the spa and see time remaining
* Turn on and off the keypad lock
* Set the operation mode (normal, economy, away or weekends mode)
* Turn on and off power saving mode
* Turn on and off sleep timers (uses already set configuration)

<p align="center">
  <img src="extras/homekitspa-iphoness.PNG" width="300">
</p>

# Upcoming Features
Here are the features planned for v2.2 or future releases:
* Allow controlling of lights hue/saturation/colour in HomeKit
* Show how long jets have left before they timeout when they are on - likely not possible however
