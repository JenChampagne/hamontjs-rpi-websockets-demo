# Real-time communication with WebSockets and a Raspberry Pi
This repository contains the code used during the HamOnt JavaScript talk on May 30th of 2019 about real-time communication with WebSockets and a Raspberry Pi by Jenifer Champagne.

# HamOnt JavaScript Meetup
https://www.meetup.com/HamOnt-JavaScript/

Folks of all JavaScript-related interests and skill levels! Please do feel welcome to go to a meetup if you're int he area!

# Talk Recording
https://youtu.be/scDg3HaVwas

# Talk Errata
- It looks like the `async` vs `Promise` conflicts I mentioned were likely specific to Bluebird `Promise`s

# Code Setup
This code was designed for use with a RaspberryPi. Unfortunately several GPIO (General Purpose Input/Output) node modules were using outdate libraries which were not compatible with the Raspberry Pi 3B+ used in the demo. As such, the wiringpi command line utility (`gpio`) was used as it was compatible with the device used.

- Install WebSocket node module
  `npm install`
- Launch the WebSocket server while initialising the GPIOs
  `npm start`

Note: This will not work on a system without the GPIO / wiringpi utility. If you are on a Raspberry Pi system and find yourself without the utility, you can install it with the following command: `sudo apt install wiringpi -y`
