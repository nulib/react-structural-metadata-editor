// Colors for segments from Avalon branding pallette
const COLOR_PALETTE = ['#80A590', '#2A5459', '#FBB040'];

export default class WaveformDataUtils {
  /**
   * Initialize Peaks instance for the app
   * @param {Array} smData - current structured metadata from the server masterfile
   */
  initSegments(smData) {
    let initSegments = [];
    let count = 0;

    // Recursively build segments for timespans in the structure
    let createSegment = items => {
      for (let item of items) {
        if (item.type === 'span') {
          count = count > 1 ? 0 : count;
          const segment = this.convertTimespanToSegment(item);
          initSegments.push({
            ...segment,
            color: COLOR_PALETTE[count]
          });
          count++;
        }
        if (item.items && item.items.length > 0) {
          createSegment(item.items);
        }
      }
    };

    // Build segments from initial metadata structure
    createSegment(smData);

    return initSegments;
  }

  /**
   * Add a temporary segment to be edited when adding a new timespan to structure
   * @param {Object} peaksInstance - peaks instance for the current waveform
   */
  insertTempSegment(peaksInstance) {
    // Current time of the playhead
    const currentTime = this.roundOff(peaksInstance.player.getCurrentTime());
    // End time of the media file
    const fileEndTime = this.roundOff(peaksInstance.player.getDuration());

    let rangeEndTime,
      rangeBeginTime = currentTime;

    const currentSegments = this.sortSegments(peaksInstance, 'startTime');

    // Validate start time of the temporary segment
    currentSegments.map(segment => {
      if (
        rangeBeginTime >= segment.startTime &&
        rangeBeginTime <= segment.endTime
      ) {
        // rounds upto 3 decimal points for accuracy
        rangeBeginTime = this.roundOff(segment.endTime);
      }
      return rangeBeginTime;
    });

    // Set the default end time of the temporary segment
    if (currentSegments.length === 0) {
      rangeEndTime =
        fileEndTime < 60
          ? fileEndTime
          : Math.round((rangeBeginTime + 60.0) * 1000) / 1000;
    } else {
      rangeEndTime = Math.round((rangeBeginTime + 60.0) * 1000) / 1000;
    }

    // Validate end time of the temporary segment
    currentSegments.map(segment => {
      if (rangeBeginTime < segment.startTime) {
        const segmentLength = segment.endTime - segment.startTime;
        if (fileEndTime < 60) {
          rangeEndTime = fileEndTime;
        }
        if (segmentLength < 60 && rangeEndTime >= segment.startTime) {
          rangeEndTime = segment.startTime;
        }
        if (
          rangeEndTime >= segment.startTime &&
          rangeEndTime < segment.endTime
        ) {
          rangeEndTime = segment.startTime;
        }
      }
      if (rangeEndTime > fileEndTime) {
        rangeEndTime = fileEndTime;
      }
      return rangeEndTime;
    });

    if (rangeBeginTime < fileEndTime && rangeEndTime > rangeBeginTime) {
      const tempSegmentLength = rangeEndTime - rangeBeginTime;
      // Continue if temp segment has a length greater than 1ms
      if (tempSegmentLength > 0.1) {
        // Move playhead to start of the temporary segment
        peaksInstance.player.seek(rangeBeginTime);

        peaksInstance.segments.add({
          startTime: rangeBeginTime,
          endTime: rangeEndTime,
          editable: true,
          color: COLOR_PALETTE[2],
          id: 'temp-segment'
        });
      }
    }

    return peaksInstance;
  }

  /**
   * Delete the corresponding segment when a timespan is deleted
   * @param {Object} item - item to be deleted
   * @param {Object} peaksInstance - peaks instance for the current waveform
   */
  deleteSegments(item, peaksInstance) {
    let deleteChildren = item => {
      let children = item.items;
      for (let child of children) {
        if (child.type === 'span') {
          peaksInstance.segments.removeById(child.id);
        }
        if (child.items && child.items.length > 0) {
          deleteChildren(child);
        }
      }
    };

    if (item.type === 'div') {
      deleteChildren(item);
    }

    peaksInstance.segments.removeById(item.id);
    return peaksInstance;
  }

  /**
   * Update the colors of the segment to alternate between colors in Avalon color pallette
   * @param {Object} peaksInstance - current peaks instance for the waveform
   */
  rebuildPeaks(peaksInstance) {
    let sortedSegments = this.sortSegments(peaksInstance, 'startTime');
    sortedSegments.forEach((segment, index) => {
      segment.update({
        color: this.isOdd(index) ? COLOR_PALETTE[1] : COLOR_PALETTE[0]
      });
    });

    return peaksInstance;
  }

  /**
   * Change color and add handles for editing the segment in the waveform
   * @param {String} id - ID of the segment to be edited
   * @param {Object} peaksInstance - current peaks instance for the waveform
   */
  activateSegment(id, peaksInstance) {
    const segment = peaksInstance.segments.getSegment(id);
    segment.update({
      editable: true,
      color: COLOR_PALETTE[2]
    });
    let startTime = segment.startTime;
    // Move play head to the start time of the selected segment
    peaksInstance.player.seek(startTime);

    return peaksInstance;
  }

  /**
   * Revert color and remove handles for editing of the segment
   * @param {String} id - ID of the segment being saved
   * @param {Object} peaksInstance - current peaks instance for the waveform
   */
  deactivateSegment(id, peaksInstance) {
    // Sorted segments by start time
    let segments = this.sortSegments(peaksInstance, 'startTime');

    let index = segments.map(seg => seg.id).indexOf(id);

    const segment = peaksInstance.segments.getSegment(id);
    segment.update({
      editable: false,
      color: this.isOdd(index) ? COLOR_PALETTE[1] : COLOR_PALETTE[0]
    });

    return peaksInstance;
  }

  /**
   * Save the segment into the Peaks
   * @param {Object} currentState - current values for the timespan to be saved
   * @param {Object} peaksInstance - current peaks instance for waveform
   */
  saveSegment(currentState, peaksInstance) {
    const { beginTime, endTime, clonedSegment } = currentState;
    clonedSegment.update({
      startTime: this.toMs(beginTime),
      endTime: this.toMs(endTime)
    });
    return peaksInstance;
  }

  /**
   * Reverse the changes made in peaks waveform when changes are cancelled
   * @param {Object} clonedSegment - cloned segment before changing peaks waveform
   * @param {Object} peaksInstance - current peaks instance for wavefrom
   */
  revertSegment(clonedSegment, peaksInstance) {
    let segment = peaksInstance.segments.getSegment(clonedSegment.id);
    const {
      startTime,
      endTime,
      labelText,
      id,
      color,
      editable
    } = clonedSegment;
    segment.update({
      startTime: startTime,
      endTime: endTime,
      labelText: labelText,
      id: id,
      color: color,
      editable: editable
    });
    return peaksInstance;
  }

  /**
   * Update Peaks instance when user changes the start and end times from the edit forms
   * @param {Object} segment - segment related to timespan
   * @param {Object} currentState - current begin and end times from the input form
   * @param {Object} peaksInstance - current peaks instance for waveform
   */
  updateSegment(segment, currentState, peaksInstance) {
    const { beginTime, endTime } = currentState;
    let beginSeconds = this.toMs(beginTime);
    let endSeconds = this.toMs(endTime);
    let changeSegment = peaksInstance.segments.getSegment(segment.id);

    if (beginSeconds < segment.endTime && segment.startTime !== beginSeconds) {
      changeSegment.update({ startTime: beginSeconds });
      return peaksInstance;
    }
    if (endSeconds > segment.startTime && segment.endTime !== endSeconds) {
      changeSegment.update({ endTime: endSeconds });
      return peaksInstance;
    }
    return peaksInstance;
  }

  /**
   * Prevent the times of segment being edited overlapping with the existing segments
   * @param {Object} segment - segement being edited in the waveform
   * @param {Object} peaksInstance - current peaks instance for waveform
   */
  validateSegment(segment, peaksInstance) {
    const allSegments = peaksInstance.segments.getSegments();
    const duration = this.roundOff(peaksInstance.player.getDuration());

    const { startTime, endTime } = segment;

    // segments before and after the editing segment
    const { before, after } = this.findWrapperSegments(segment, allSegments);

    // index of the segment in the arrays
    const segmentIndex = allSegments.map(seg => seg.id).indexOf(segment.id);

    for (let i = 0; i < allSegments.length; i++) {
      const current = allSegments[i];
      if (current.id == segment.id) {
        continue;
      }
      if (startTime > current.startTime && endTime < current.endTime) {
        segment.startTime = current.endTime;
        segment.endTime = current.endTime + 0.001;
      } else if (
        duration - 0.001 <= endTime &&
        endTime <= duration &&
        after &&
        after.id === current.id
      ) {
        segment.endTime = after.startTime;
      } else if (
        before &&
        before.id === current.id &&
        startTime < before.endTime
      ) {
        segment.startTime = before.endTime;
      } else if (
        after &&
        after.id === current.id &&
        endTime > after.startTime
      ) {
        segment.endTime = after.startTime;
      } else if (startTime > current.startTime && startTime < current.endTime) {
        segment.startTime =
          i < segmentIndex ? current.endTime : current.startTime;
      } else if (endTime > current.startTime && endTime < current.endTime) {
        segment.endTime =
          i < segmentIndex ? current.startTime : current.endTime;
      } else if (segment.startTime === segment.endTime) {
        segment.endTime = segment.startTime + 0.001;
      } else if (endTime > duration) {
        segment.endTime = duration;
      }
    }
    return segment;
  }

  /**
   * Convert timespan to segment to be consumed within peaks instance
   * @param {Object} timespan
   */
  convertTimespanToSegment(timespan) {
    const { begin, end, label, id } = timespan;
    return {
      startTime: this.toMs(begin),
      endTime: this.toMs(end),
      labelText: label,
      id: id
    };
  }

  /**
   * Find the before and after segments of a given segment
   * @param {Object} currentSegment - current segment being added/edited
   * @param {Array} allSegments - segments in the current peaks instance
   */
  findWrapperSegments(currentSegment, allSegments) {
    let wrapperSegments = {
      before: null,
      after: null
    };
    const { startTime, endTime } = currentSegment;
    const timeFixedSegments = allSegments.map(seg => {
      return {
        ...seg,
        startTime: this.roundOff(seg.startTime),
        endTime: this.roundOff(seg.endTime)
      };
    });

    wrapperSegments.after = timeFixedSegments.filter(
      seg => seg.startTime > startTime
    )[0];
    const segmentsBefore = timeFixedSegments.filter(
      seg => seg.endTime < endTime
    );
    if (segmentsBefore) {
      wrapperSegments.before = segmentsBefore[segmentsBefore.length - 1];
    }
    return wrapperSegments;
  }

  isOdd(num) {
    return num % 2;
  }

  toMs(strTime) {
    let [hours, minutes, seconds] = strTime.split(':');
    let hoursAndMins = parseInt(hours) * 3600 + parseInt(minutes) * 60;
    let secondsIn = seconds === '' ? 0.0 : parseFloat(seconds);
    return Math.round((hoursAndMins + secondsIn) * 1000) / 1000;
  }

  sortSegments(peaksInstance, sortBy) {
    let segments = peaksInstance.segments.getSegments();
    segments.sort((x, y) => x[sortBy] - y[sortBy]);
    return segments;
  }

  roundOff(value) {
    var valueString = '';
    var [intVal, decVal] = value.toString().split('.');
    if (!decVal) {
      valueString = intVal;
    } else {
      valueString = intVal + '.' + decVal.substring(0, 3);
    }
    return parseFloat(valueString);
  }
}
