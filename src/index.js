let audioCtx = null;
const spatializedStreams = new Map();

const spatializeStream = (audioStream) => {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  const source = audioCtx.createMediaStreamSource(audioStream);
  const destination = audioCtx.createMediaStreamDestination();
  const panner = audioCtx.createStereoPanner();

  source.connect(panner);
  panner.connect(destination);

  audioStream.getAudioTracks()[0].onended = () => {
    source.disconnect();
    panner.disconnect();
    destination.disconnect();
  };

  return { stream: destination.stream, panner };
};

export const spatialize = (audioStream) => {
  const [audioTrack] = audioStream.getAudioTracks();
  if (!audioTrack) {
    return {};
  }

  const { stream, panner } = spatializeStream(audioStream);

  audioTrack.addEventListener('ended', () => {
    stream.getTracks().forEach((t) => t.stop());
  });

  // Need to keep playing the original audio stream
  const audio = new Audio();
  audio.muted = true;
  audio.srcObject = audioStream;
  audio.play();

  return {
    panner,
    stream: new MediaStream([
      ...stream.getTracks(),
      ...audioStream.getVideoTracks(),
    ]),
  };
};

let observer;
let resizeObserver;

export const start = async (options) => {
  const log = (...args) => {
    if (options && options.log) {
      console.log('rtc-spatial', ...args);
    }
  };

  log('start spatialization');
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  const updateElement = (element) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.x + rect.width / 2;
    update(element, centerX / window.innerWidth - 0.5);
  };

  const update = (element, position) => {
    log('update ' + element.id + ' ' + position);
    const value = position * 2;
    const panner = element.panner;
    if (panner && panner.pan) {
      panner.pan.setValueAtTime(value, audioCtx.currentTime);
    }
  };

  const initializeSpatialization = (element) => {
    const source = element.srcObject;

    if (source && source.getAudioTracks().length) {
      const { stream, panner } = spatialize(source);
      element.panner = panner;
      element.srcObject = stream;
    }
  };

  const getParticipantId = (element, mapper) => {
    return mapper
      ? mapper(element)
      : element.srcObject
      ? element.srcObject.id
      : 'unknown';
  };

  const handleAddedVideo = (videoElement) => {
    log('handleAddedVideo', videoElement);

    if (options && options.videoMapper && !options.videoMapper(videoElement)) {
      return;
    }
    const participantId = getParticipantId(
      videoElement,
      options && options.videoMapper
    );

    initializeSpatialization(videoElement);
    let spatialized = spatializedStreams.get(participantId);
    if (!spatialized) {
      log('created spatialized stream', participantId);
      spatialized = {};
      spatializedStreams.set(participantId, spatialized);
    }
    spatialized.videoElement = videoElement;

    const audioElement = spatialized.audioElement;
    if (audioElement) {
      videoElement.panner = audioElement.panner;
    }

    if (videoElement.panner) {
      updateElement(videoElement);
    }

    resizeObserver.observe(videoElement);
    observer.observe(videoElement, {
      subtree: false,
      childList: false,
      attributes: true,
    });
  };

  const handleAddedAudio = (audioElement) => {
    log('handleAddedAudio', audioElement);

    if (options && options.audioMapper && !options.audioMapper(audioElement)) {
      return;
    }
    const participantId = getParticipantId(
      audioElement,
      options && options.audioMapper
    );

    initializeSpatialization(audioElement);
    let spatialized = spatializedStreams.get(participantId);
    if (!spatialized) {
      log('created spatialized stream', participantId);
      spatialized = {};
      spatializedStreams.set(participantId, spatialized);
    }
    spatialized.audioElement = audioElement;

    const videoElement = spatialized.videoElement;
    if (videoElement) {
      videoElement.panner = audioElement.panner;
      updateElement(videoElement);
    }
  };

  const handleRemovedVideo = (videoElement) => {
    log('handleRemovedVideo', videoElement);

    const participantId = getParticipantId(videoElement, options.videoMapper);

    const spatialized = spatializedStreams.get(participantId);
    if (spatialized && spatialized.videoElement === videoElement) {
      delete spatialized.videoElement;
      if (!spatialized.audioElement) {
        log('destroyed spatialized stream', participantId);
        spatializedStreams.delete(participantId);
      }
    }
  };

  const handleRemovedAudio = (audioElement) => {
    log('handleRemovedAudio', audioElement);

    const participantId = getParticipantId(audioElement, options.audioMapper);

    const spatialized = spatializedStreams.get(participantId);
    if (spatialized && spatialized.audioElement === audioElement) {
      delete spatialized.audioElement;
      if (!spatialized.videoElement) {
        log('destroyed spatialized stream', participantId);
        spatializedStreams.delete(participantId);
      }
    }
  };

  const handleNode = (node, audioHandler, videoHandler) => {
    if (node.tagName === 'VIDEO') {
      videoHandler(node);
    } else if (node.tagName === 'AUDIO') {
      audioHandler(node);
    } else if (node.querySelector) {
      const video = node.querySelector('video');
      if (video) {
        videoHandler(video);
      } else {
        const audio = node.querySelector('audio');
        if (audio) {
          audioHandler(audio);
        }
      }
    }
  };

  observer = new MutationObserver((mutationList, _observer) => {
    mutationList.forEach((record) => {
      if (record.type === 'childList') {
        record.addedNodes.forEach((node) => {
          handleNode(node, handleAddedAudio, handleAddedVideo);
        });
        record.removedNodes.forEach((node) => {
          handleNode(node, handleRemovedAudio, handleRemovedVideo);
        });
      } else if (record.type === 'attributes' && record.target.panner) {
        updateElement(record.target);
      }
    });
  });

  resizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target.panner) {
        updateElement(entry.target);
      }
    });
  });

  const videos = document.getElementsByTagName('video');
  [...videos].forEach((video) => {
    handleAddedVideo(video);
  });
  const audios = document.getElementsByTagName('audio');
  [...audios].forEach((audio) => {
    handleAddedAudio(audio);
  });

  // TODO: Only observe container
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: false,
  });
};

export const stop = () => {
  if (observer) {
    observer.disconnect();
    observer = undefined;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = undefined;
  }
  spatializedStreams.clear();
};
