﻿import React from 'react';
import config from '../../../config';

class EditModel extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let { widget } = this.props;
    let { data } = widget;
    return (
      <div className="editModel editTextInput">
        <input type="text" placeholder={data.hint} />
      </div>
    );
  }
}

export default {
  type: config.WIDGETS.TEXT_INPUT.type,
  EditModel,
};
