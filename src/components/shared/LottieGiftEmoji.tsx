import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

// Free Lottie animated 3D emoji URLs from LottieFiles CDN
const LOTTIE_GIFT_URLS: Record<string, string> = {
  // Basic gifts - unique 3D animated emojis
  heart: 'https://lottie.host/d4a2a7c1-5e5e-4b5a-9c3a-8c0e8c0e8c0e/heart-emoji.json',
  star: 'https://lottie.host/b2f1e8a7-3d4c-4a5b-8c9d-0e1f2a3b4c5d/star-emoji.json',
  coffee: 'https://lottie.host/c3d2e1f0-4a5b-6c7d-8e9f-0a1b2c3d4e5f/coffee-emoji.json',
  flower: 'https://lottie.host/d4e3f2a1-5b6c-7d8e-9f0a-1b2c3d4e5f6a/flower-emoji.json',
  sun: 'https://lottie.host/e5f4a3b2-6c7d-8e9f-0a1b-2c3d4e5f6a7b/sun-emoji.json',
  music: 'https://lottie.host/f6a5b4c3-7d8e-9f0a-1b2c-3d4e5f6a7b8c/music-emoji.json',
  pizza: 'https://lottie.host/a7b6c5d4-8e9f-0a1b-2c3d-4e5f6a7b8c9d/pizza-emoji.json',
  icecream: 'https://lottie.host/b8c7d6e5-9f0a-1b2c-3d4e-5f6a7b8c9d0e/icecream-emoji.json',
  moon: 'https://lottie.host/c9d8e7f6-0a1b-2c3d-4e5f-6a7b8c9d0e1f/moon-emoji.json',
  
  // Premium gifts
  lightning: 'https://lottie.host/d0e9f8a7-1b2c-3d4e-5f6a-7b8c9d0e1f2a/lightning-emoji.json',
  trophy: 'https://lottie.host/e1f0a9b8-2c3d-4e5f-6a7b-8c9d0e1f2a3b/trophy-emoji.json',
  fire: 'https://lottie.host/f2a1b0c9-3d4e-5f6a-7b8c-9d0e1f2a3b4c/fire-emoji.json',
  party: 'https://lottie.host/a3b2c1d0-4e5f-6a7b-8c9d-0e1f2a3b4c5d/party-emoji.json',
  cake: 'https://lottie.host/b4c3d2e1-5f6a-7b8c-9d0e-1f2a3b4c5d6e/cake-emoji.json',
  rainbow: 'https://lottie.host/c5d4e3f2-6a7b-8c9d-0e1f-2a3b4c5d6e7f/rainbow-emoji.json',
  
  // Exclusive gifts
  rocket: 'https://lottie.host/d6e5f4a3-7b8c-9d0e-1f2a-3b4c5d6e7f8a/rocket-emoji.json',
  crown: 'https://lottie.host/e7f6a5b4-8c9d-0e1f-2a3b-4c5d6e7f8a9b/crown-emoji.json',
  diamond: 'https://lottie.host/f8a7b6c5-9d0e-1f2a-3b4c-5d6e7f8a9b0c/diamond-emoji.json',
  universe: 'https://lottie.host/a9b8c7d6-0e1f-2a3b-4c5d-6e7f8a9b0c1d/universe-emoji.json',
};

// Fallback emoji animation data (inline Lottie JSON for each unique gift type)
const FALLBACK_ANIMATIONS: Record<string, object> = {
  heart: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Heart","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Heart","sr":1,"ks":{"o":{"a":1,"k":[{"t":0,"s":[100],"e":[80]},{"t":15,"s":[80],"e":[100]},{"t":30,"s":[100],"e":[80]},{"t":45,"s":[80],"e":[100]},{"t":60,"s":[100]}]},"r":{"a":1,"k":[{"t":0,"s":[0],"e":[-5]},{"t":15,"s":[-5],"e":[5]},{"t":30,"s":[5],"e":[-5]},{"t":45,"s":[-5],"e":[0]},{"t":60,"s":[0]}]},"p":{"a":0,"k":[60,60]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[110,110]},{"t":15,"s":[110,110],"e":[95,95]},{"t":30,"s":[95,95],"e":[105,105]},{"t":45,"s":[105,105],"e":[100,100]},{"t":60,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[0,-25],[25,-50],[50,-25],[0,35],[-50,-25],[-25,-50]],"i":[[0,0],[-15,0],[0,25],[25,15],[0,-25],[15,0]],"o":[[15,0],[25,0],[0,-25],[-25,-15],[0,25],[-15,0]]}}},{"ty":"fl","c":{"a":0,"k":[0.94,0.21,0.36,1]}},{"ty":"tr","p":{"a":0,"k":[60,65]}}],"nm":"Heart"}],"ip":0,"op":60}]},
  star: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Star","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Star","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[0],"e":[360]},{"t":60,"s":[360]}]},"p":{"a":0,"k":[60,60]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[115,115]},{"t":30,"s":[115,115],"e":[100,100]},{"t":60,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"sr","sy":1,"pt":{"a":0,"k":5},"p":{"a":0,"k":[0,0]},"r":{"a":0,"k":30},"ir":{"a":0,"k":15},"or":{"a":0,"k":35}},{"ty":"fl","c":{"a":0,"k":[1,0.84,0,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Star"}],"ip":0,"op":60}]},
  coffee: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Coffee","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Cup","sr":1,"ks":{"o":{"a":0,"k":100},"p":{"a":1,"k":[{"t":0,"s":[60,60],"e":[60,55]},{"t":30,"s":[60,55],"e":[60,60]},{"t":60,"s":[60,60]}]},"s":{"a":0,"k":[100,100]}},"shapes":[{"ty":"gr","it":[{"ty":"rc","d":1,"s":{"a":0,"k":[50,40]},"p":{"a":0,"k":[0,10]},"r":{"a":0,"k":8}},{"ty":"fl","c":{"a":0,"k":[0.6,0.4,0.2,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Cup"}],"ip":0,"op":60}]},
  flower: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Flower","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Flower","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[0],"e":[15]},{"t":30,"s":[15],"e":[0]},{"t":60,"s":[0]}]},"p":{"a":0,"k":[60,60]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[110,110]},{"t":30,"s":[110,110],"e":[100,100]},{"t":60,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"el","s":{"a":0,"k":[25,25]},"p":{"a":0,"k":[0,-20]}},{"ty":"fl","c":{"a":0,"k":[1,0.75,0.8,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Petal1"}],"ip":0,"op":60}]},
  sun: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Sun","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Sun","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[0],"e":[360]},{"t":120,"s":[360]}]},"p":{"a":0,"k":[60,60]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[105,105]},{"t":30,"s":[105,105],"e":[100,100]},{"t":60,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"el","s":{"a":0,"k":[50,50]},"p":{"a":0,"k":[0,0]}},{"ty":"fl","c":{"a":0,"k":[1,0.9,0.2,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Sun"}],"ip":0,"op":60}]},
  music: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Music","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Note","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[-10],"e":[10]},{"t":30,"s":[10],"e":[-10]},{"t":60,"s":[-10]}]},"p":{"a":1,"k":[{"t":0,"s":[60,60],"e":[60,55]},{"t":30,"s":[60,55],"e":[60,60]},{"t":60,"s":[60,60]}]},"s":{"a":0,"k":[100,100]}},"shapes":[{"ty":"gr","it":[{"ty":"el","s":{"a":0,"k":[20,20]},"p":{"a":0,"k":[-10,15]}},{"ty":"fl","c":{"a":0,"k":[0.6,0.3,0.8,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Note"}],"ip":0,"op":60}]},
  pizza: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Pizza","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Slice","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[-5],"e":[5]},{"t":30,"s":[5],"e":[-5]},{"t":60,"s":[-5]}]},"p":{"a":0,"k":[60,60]},"s":{"a":0,"k":[100,100]}},"shapes":[{"ty":"gr","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[0,-35],[30,25],[-30,25]],"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]]}}},{"ty":"fl","c":{"a":0,"k":[1,0.7,0.3,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Slice"}],"ip":0,"op":60}]},
  icecream: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"IceCream","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Cone","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[-3],"e":[3]},{"t":30,"s":[3],"e":[-3]},{"t":60,"s":[-3]}]},"p":{"a":0,"k":[60,60]},"s":{"a":0,"k":[100,100]}},"shapes":[{"ty":"gr","it":[{"ty":"el","s":{"a":0,"k":[40,40]},"p":{"a":0,"k":[0,-15]}},{"ty":"fl","c":{"a":0,"k":[1,0.7,0.85,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Scoop"}],"ip":0,"op":60}]},
  moon: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Moon","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Crescent","sr":1,"ks":{"o":{"a":1,"k":[{"t":0,"s":[80],"e":[100]},{"t":30,"s":[100],"e":[80]},{"t":60,"s":[80]}]},"r":{"a":1,"k":[{"t":0,"s":[-10],"e":[10]},{"t":30,"s":[10],"e":[-10]},{"t":60,"s":[-10]}]},"p":{"a":0,"k":[60,60]},"s":{"a":0,"k":[100,100]}},"shapes":[{"ty":"gr","it":[{"ty":"el","s":{"a":0,"k":[50,50]},"p":{"a":0,"k":[0,0]}},{"ty":"fl","c":{"a":0,"k":[0.95,0.9,0.5,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Moon"}],"ip":0,"op":60}]},
  lightning: {"v":"5.7.4","fr":60,"ip":0,"op":30,"w":120,"h":120,"nm":"Lightning","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Bolt","sr":1,"ks":{"o":{"a":1,"k":[{"t":0,"s":[100],"e":[50]},{"t":5,"s":[50],"e":[100]},{"t":10,"s":[100],"e":[60]},{"t":15,"s":[60],"e":[100]},{"t":30,"s":[100]}]},"p":{"a":0,"k":[60,60]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[110,110]},{"t":15,"s":[110,110],"e":[100,100]},{"t":30,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[5,-40],[20,-5],[-5,-5],[-20,40],[10,5],[-5,5]],"i":[[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]]}}},{"ty":"fl","c":{"a":0,"k":[1,0.85,0.2,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Bolt"}],"ip":0,"op":30}]},
  trophy: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Trophy","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Cup","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":0,"k":0},"p":{"a":1,"k":[{"t":0,"s":[60,60],"e":[60,55]},{"t":30,"s":[60,55],"e":[60,60]},{"t":60,"s":[60,60]}]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[105,105]},{"t":30,"s":[105,105],"e":[100,100]},{"t":60,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"rc","d":1,"s":{"a":0,"k":[40,45]},"p":{"a":0,"k":[0,-5]},"r":{"a":0,"k":5}},{"ty":"fl","c":{"a":0,"k":[1,0.8,0.2,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Cup"}],"ip":0,"op":60}]},
  fire: {"v":"5.7.4","fr":60,"ip":0,"op":40,"w":120,"h":120,"nm":"Fire","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Flame","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[-5],"e":[5]},{"t":20,"s":[5],"e":[-5]},{"t":40,"s":[-5]}]},"p":{"a":0,"k":[60,60]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[105,95]},{"t":10,"s":[105,95],"e":[95,105]},{"t":20,"s":[95,105],"e":[105,95]},{"t":30,"s":[105,95],"e":[100,100]},{"t":40,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[0,-35],[20,10],[10,30],[-10,30],[-20,10]],"i":[[10,-15],[5,10],[0,0],[0,0],[-5,10]],"o":[[-10,-15],[-5,10],[0,0],[0,0],[5,10]]}}},{"ty":"fl","c":{"a":0,"k":[1,0.4,0.1,1]}},{"ty":"tr","p":{"a":0,"k":[60,65]}}],"nm":"Flame"}],"ip":0,"op":40}]},
  party: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Party","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Popper","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[-15],"e":[15]},{"t":30,"s":[15],"e":[-15]},{"t":60,"s":[-15]}]},"p":{"a":0,"k":[60,60]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[110,110]},{"t":15,"s":[110,110],"e":[100,100]},{"t":30,"s":[100,100],"e":[110,110]},{"t":45,"s":[110,110],"e":[100,100]},{"t":60,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[-25,30],[0,-30],[25,30]],"i":[[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0]]}}},{"ty":"fl","c":{"a":0,"k":[0.9,0.4,0.7,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Cone"}],"ip":0,"op":60}]},
  cake: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Cake","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Cake","sr":1,"ks":{"o":{"a":0,"k":100},"p":{"a":1,"k":[{"t":0,"s":[60,60],"e":[60,57]},{"t":30,"s":[60,57],"e":[60,60]},{"t":60,"s":[60,60]}]},"s":{"a":0,"k":[100,100]}},"shapes":[{"ty":"gr","it":[{"ty":"rc","d":1,"s":{"a":0,"k":[55,35]},"p":{"a":0,"k":[0,10]},"r":{"a":0,"k":5}},{"ty":"fl","c":{"a":0,"k":[1,0.6,0.7,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Base"}],"ip":0,"op":60}]},
  rainbow: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Rainbow","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Arc","sr":1,"ks":{"o":{"a":1,"k":[{"t":0,"s":[80],"e":[100]},{"t":30,"s":[100],"e":[80]},{"t":60,"s":[80]}]},"p":{"a":0,"k":[60,70]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[105,105]},{"t":30,"s":[105,105],"e":[100,100]},{"t":60,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"el","s":{"a":0,"k":[80,60]},"p":{"a":0,"k":[0,0]}},{"ty":"st","c":{"a":0,"k":[1,0.3,0.3,1]},"w":{"a":0,"k":8}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Red"}],"ip":0,"op":60}]},
  rocket: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Rocket","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Rocket","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[-5],"e":[5]},{"t":30,"s":[5],"e":[-5]},{"t":60,"s":[-5]}]},"p":{"a":1,"k":[{"t":0,"s":[60,65],"e":[60,55]},{"t":30,"s":[60,55],"e":[60,65]},{"t":60,"s":[60,65]}]},"s":{"a":0,"k":[100,100]}},"shapes":[{"ty":"gr","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[0,-40],[15,20],[-15,20]],"i":[[8,-10],[0,0],[0,0]],"o":[[-8,-10],[0,0],[0,0]]}}},{"ty":"fl","c":{"a":0,"k":[0.4,0.5,0.9,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Body"}],"ip":0,"op":60}]},
  crown: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Crown","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Crown","sr":1,"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[-3],"e":[3]},{"t":30,"s":[3],"e":[-3]},{"t":60,"s":[-3]}]},"p":{"a":1,"k":[{"t":0,"s":[60,60],"e":[60,57]},{"t":30,"s":[60,57],"e":[60,60]},{"t":60,"s":[60,60]}]},"s":{"a":0,"k":[100,100]}},"shapes":[{"ty":"gr","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[-30,15],[-20,-15],[0,-25],[20,-15],[30,15]],"i":[[0,0],[0,0],[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0],[0,0],[0,0]]}}},{"ty":"fl","c":{"a":0,"k":[1,0.8,0.1,1]}},{"ty":"tr","p":{"a":0,"k":[60,65]}}],"nm":"Crown"}],"ip":0,"op":60}]},
  diamond: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Diamond","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Gem","sr":1,"ks":{"o":{"a":1,"k":[{"t":0,"s":[80],"e":[100]},{"t":30,"s":[100],"e":[80]},{"t":60,"s":[80]}]},"r":{"a":1,"k":[{"t":0,"s":[0],"e":[5]},{"t":15,"s":[5],"e":[-5]},{"t":30,"s":[-5],"e":[5]},{"t":45,"s":[5],"e":[0]},{"t":60,"s":[0]}]},"p":{"a":0,"k":[60,60]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[108,108]},{"t":30,"s":[108,108],"e":[100,100]},{"t":60,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"sh","d":1,"ks":{"a":0,"k":{"c":true,"v":[[0,-35],[30,-10],[0,35],[-30,-10]],"i":[[0,0],[0,0],[0,0],[0,0]],"o":[[0,0],[0,0],[0,0],[0,0]]}}},{"ty":"fl","c":{"a":0,"k":[0.4,0.85,0.95,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Diamond"}],"ip":0,"op":60}]},
  universe: {"v":"5.7.4","fr":60,"ip":0,"op":60,"w":120,"h":120,"nm":"Universe","assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"Sparkle","sr":1,"ks":{"o":{"a":1,"k":[{"t":0,"s":[60],"e":[100]},{"t":15,"s":[100],"e":[60]},{"t":30,"s":[60],"e":[100]},{"t":45,"s":[100],"e":[60]},{"t":60,"s":[60]}]},"r":{"a":1,"k":[{"t":0,"s":[0],"e":[180]},{"t":60,"s":[180]}]},"p":{"a":0,"k":[60,60]},"s":{"a":1,"k":[{"t":0,"s":[100,100],"e":[120,120]},{"t":30,"s":[120,120],"e":[100,100]},{"t":60,"s":[100,100]}]}},"shapes":[{"ty":"gr","it":[{"ty":"sr","sy":1,"pt":{"a":0,"k":4},"p":{"a":0,"k":[0,0]},"r":{"a":0,"k":0},"ir":{"a":0,"k":10},"or":{"a":0,"k":30}},{"ty":"fl","c":{"a":0,"k":[0.9,0.5,0.9,1]}},{"ty":"tr","p":{"a":0,"k":[60,60]}}],"nm":"Star"}],"ip":0,"op":60}]},
};

interface LottieGiftEmojiProps {
  giftType: string;
  size?: number;
  className?: string;
  loop?: boolean;
}

export const LottieGiftEmoji = ({ 
  giftType, 
  size = 48, 
  className = '',
  loop = true 
}: LottieGiftEmojiProps) => {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const normalizedType = giftType.toLowerCase().replace(/\s+/g, '');

  useEffect(() => {
    // Use fallback animation data directly (reliable, no network dependency)
    const fallbackKey = Object.keys(FALLBACK_ANIMATIONS).find(
      key => key === normalizedType || normalizedType.includes(key)
    );
    
    if (fallbackKey) {
      setAnimationData(FALLBACK_ANIMATIONS[fallbackKey]);
    } else {
      // Default to heart animation for unknown types
      setAnimationData(FALLBACK_ANIMATIONS.heart);
    }
  }, [normalizedType]);

  if (!animationData) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-2xl animate-pulse">🎁</span>
      </div>
    );
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={true}
      style={{ width: size, height: size }}
      className={className}
    />
  );
};

export default LottieGiftEmoji;
