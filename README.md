# RTC SPATIAL

Library to spatialize audio signals for audio and video real time communications.  The library makes use of the exising StereoPanner audio API available in most of the browsers.

To learn more about audio spatialization you can read this Unreal Engine document: https://docs.unrealengine.com/5.0/en-US/spatialization-overview-in-unreal-engine/

To learn more about the SterePanner you can check the MDN documentation: https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode

It has been only tested with Chrome but should work in other browsers too.

## Install

The library can be installed as an npm package dependency in your project:

```
npm install rtc-spatial
```

## How to spatialize audio streams

There are two ways you can use this library, the automatic mode provides a very easy way to integrate it without having to modify the application and the manual mode provides a more flexible and efficient way to do it.

Given how simple the code in this library is there is a third option consisting on copying the code to your application or just use it for inspiration when implementing it inside your application :)

The automatic mode detects automatically the audio and video elements in the page and spatialize their attached streams when the position of those video elements change.

The manual mode provides an API to map a specific audio stream to a spatialized version of it and provides the panner associated to that stream so that the application can control the panning based on the position of the elements or other application logic. 

### Automatic mode

In automatic mode there are just two simple start() and stop() APIs.   The start API has some parameters to configure the association between audio and video elements for applications that use separated elements for a single participant.  For the applications using a single video element per participant it should work out of the box.

`start(options)`

Options:
* `audioMapper: (audioElement): string`  Provide a function to extract the participantId corresponding to a specific audio element in the DOM.   For example if the application is using the participantId as part of the element ID that can be a way to do the mapping.
* `videoMapper: (videoElement): string`  Provide a function to extract the participantId corresponding to a specific video element in the DOM.   For example if the application is using the participantId as part of the element ID that can be a way to do the mapping.

```
start({ 
    audioMapper: (audio) => audio.id.split('-')[1],
    videoMapper: (video) => video.id.split('-')[1],
})
```

### Manual mode

In manual mode there is a single simple API exposed that is `spatialize()`.    In this mode the library provides a very tiny wrapper that is around 10 lines of code so you can consider copying the code instead of importing the library.

`const { stream, panner } = spatialize(stream)`

The panner returned is a standard Web panner with a value betwen -1 and 1.


## Additional considerations

Echo cancellation is only enabled for the original audio streams from a RTCPeerConnection and not any other audio stream played back in the browser like the spatialized streams in this case.   So in case the user is not using headphones it is very likely to introduce echo in the conversation when using spatialization and it is recommended to disable spatialization in that case.    This can be workarounded with some tricks if really needed but another option is to wait for a new version of Chrome that should solve this limitation soon.

Most of bluetooth headphones don't support stereo mode for audio playback while using them to acapture audio from the microphone, so those users won't notice the effect of spatialization.
