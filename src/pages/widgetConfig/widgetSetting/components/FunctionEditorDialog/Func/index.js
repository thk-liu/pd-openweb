import React, { Fragment, useEffect, useRef, useState } from 'react';
import { arrayOf, bool, func, shape } from 'prop-types';
import styled from 'styled-components';
import { Switch } from 'ming-ui';
import EventEmitter from 'events';
import { validateFnExpression } from 'src/pages/worksheet/util';
import SelectFnControl from './common/SelectFnControl';
import CodeEdit from './common/CodeEdit';
import Tip from './common/Tip';
import Footer from './common/Footer';
import './style.less';
import cx from 'classnames';

window.emitter = new EventEmitter();

const Con = styled.div`
  display: flex;
  height: 100%;
  flex-direction: column;
  color: #333;
`;
const Header = styled.div`
  height: 50px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 17px;
  font-weight: bold;
  padding: 0 24px;
  line-height: 50px;
`;
const Main = styled.div`
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
`;
const SelectFnControlCon = styled.div`
  width: 320px;
  background: #fafafa;
`;
const Dev = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 0 24px;
  overflow: hidden;
`;
const CodeEditCon = styled.div`
  flex: 1;
  height: 260px;
`;
const TipCon = styled.div`
  height: 200px;
  border-top: 1px solid #f0f0f0;
`;

const ActiveJsSwitchCon = styled.div`
  float: right;
  display: flex;
  font-weight: normal;
  align-items: center;
  margin: 16px 30px;
  line-height: 1em;
  font-size: 14px;
  label {
    margin-right: 6px;
  }
  .txt {
    font-family: monospace;
    line-height: 22px !important;
  }
`;

export default function Func(props) {
  const {
    supportJavaScript,
    value,
    value: { expression } = {},
    title,
    renderTag,
    onClose,
    controlGroups,
    onSave,
    className,
  } = props;
  const [type, setType] = useState(value.type || 'mdfunction');
  const [codeEditorLoading, setCodeEditorLoading] = useState(false);
  let { controls = [] } = props;
  if (_.isArray(controlGroups)) {
    controls = _.flatten(controlGroups.map(group => group.controls));
  }
  const codeEditor = useRef();
  const editorFunctions = key => {
    return (...args) => {
      if (codeEditor.current) {
        codeEditor.current[key](...args);
      } else {
        console.error('codeEditor mount failed');
      }
    };
  };
  function handleSave() {
    if (codeEditor.current) {
      const expression = codeEditor.current.getValue();

      let available = validateFnExpression(expression, type);
      const controlIds = (expression.match(/\$(.+?)\$/g) || []).map(id => id.slice(1, -1));
      if (
        controlIds.filter(
          id =>
            !_.find(controls, {
              controlId: /^[a-zA-Z0-9]+-[a-zA-Z0-9_]+$/.test(id) ? id.replace(/[a-zA-Z0-9]+-/, '') : id,
            }),
        ).length
      ) {
        // 存在已删除字段
        available = false;
      }
      console.log({ available });
      onSave({
        type,
        expression,
        status: available ? 1 : -1,
      });
      onClose();
    }
  }
  return (
    <Con className={cx('functionEditor', className)}>
      <Header>
        {_l('编辑函数')}
        {supportJavaScript && (
          <ActiveJsSwitchCon>
            <Switch
              size="small"
              checked={type === 'javascript'}
              onClick={checked => {
                setType(checked ? 'mdfunction' : 'javascript');
                setCodeEditorLoading(true);
                setTimeout(() => {
                  setCodeEditorLoading(false);
                }, 10);
                setTimeout(() => {
                  codeEditor.current.setValue('');
                }, 20);
              }}
            />
            {_l('自定义函数')}
          </ActiveJsSwitchCon>
        )}
      </Header>
      <Main>
        <SelectFnControlCon>
          <SelectFnControl
            type={type}
            controlGroups={controlGroups}
            controls={controls}
            insertTagToEditor={editorFunctions('insertTag')}
            insertFn={editorFunctions('insertFn')}
          />
        </SelectFnControlCon>
        <Dev>
          <CodeEditCon>
            {!codeEditorLoading && (
              <CodeEdit
                type={type}
                value={expression}
                title={title}
                controls={controls}
                ref={codeEditor}
                renderTag={renderTag}
              />
            )}
          </CodeEditCon>
          <TipCon>
            <Tip type={type} />
          </TipCon>
          <Footer onClose={onClose} onSave={handleSave} />
        </Dev>
      </Main>
    </Con>
  );
}

Func.propTypes = {
  supportJavaScript: bool,
  value: shape({}),
  control: shape({}),
  controls: arrayOf(shape({})),
  controlGroups: arrayOf(shape({})), // { controlName, controlId }
  renderTag: func,
  onClose: func,
  onSave: func,
};
