import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { ScrollView, EditingBar } from 'ming-ui';
import { openRecordInfo } from 'worksheet/common/recordInfo';
import { getFormDataForNewRecord, submitNewRecord } from 'worksheet/controllers/record';
import {
  getSubListError,
  formatRecordToRelateRecord,
  isRelateRecordTableControl,
  getRecordTempValue,
  parseRecordTempValue,
  saveToLocal,
  removeFromLocal,
} from 'worksheet/util';
import RecordForm from 'worksheet/common/recordInfo/RecordForm';
import Share from 'src/pages/worksheet/components/Share';
import { browserIsMobile } from 'src/util';
import './NewRecord.less';
import { BUTTON_ACTION_TYPE } from './NewRecord';

const Con = styled.div`
  height: 100%;
  margin: 0 -24px;
  .newRecordTitle,
  .customFieldsCon {
    padding: 0 24px;
  }
`;
const EditingBarCon = styled.div`
  position: absolute;
  top: 2px;
  width: 100%;
  overflow: hidden;
  height: 86px;
`;

function foucsInput(formcon) {
  if (!formcon) {
    return;
  }
  const $firstText = formcon.querySelector(
    '.customFieldsContainer .customFormItem:first-child .customFormTextareaBox input.smallInput',
  );
  if ($firstText) {
    $firstText.click();
  }
}
function NewRecordForm(props) {
  const {
    loading,
    from,
    isCharge,
    notDialog,
    appId,
    viewId,
    worksheetId,
    title,
    entityName,
    showTitle,
    needCache,
    defaultRelatedSheet,
    defaultFormDataEditable,
    defaultFormData,
    writeControls,
    registerFunc,
    masterRecord,
    masterRecordRowId,
    shareVisible,
    advancedSetting = {},
    setShareVisible = () => {},
    onSubmitBegin = () => {},
    onSubmitEnd = () => {},
    onAdd = () => {},
    onCancel = () => {},
    openRecord,
  } = props;
  const tempNewRecord = needCache && viewId && localStorage.getItem('tempNewRecord_' + viewId);
  const cache = useRef({});
  const cellObjs = useRef({});
  const isSubmitting = useRef(false);
  const customwidget = useRef();
  const formcon = useRef();
  const [formLoading, setFormLoading] = useState(true);
  const [restoreVisible, setRestoreVisible] = useState(!!tempNewRecord);
  const [relateRecordData, setRelateRecordData] = useState({});
  const [worksheetInfo, setWorksheetInfo] = useState(_.cloneDeep(props.worksheetInfo || {}));
  const [originFormdata, setOriginFormdata] = useState([]);
  const [formdata, setFormdata] = useState([]);
  const { projectId, publicShareUrl, visibleType } = worksheetInfo;
  const [errorVisible, setErrorVisible] = useState();
  const [random, setRandom] = useState();
  const [requesting, setRequesting] = useState();
  useEffect(() => {
    async function load() {
      if (_.isEmpty(formdata)) {
        setWorksheetInfo(props.worksheetInfo);
        const newFormdata = await getFormDataForNewRecord({
          worksheetInfo: props.worksheetInfo,
          defaultRelatedSheet,
          defaultFormData,
          defaultFormDataEditable,
          writeControls,
        });
        setFormdata(newFormdata);
        setOriginFormdata(newFormdata);
        setFormLoading(false);
      }
      setTimeout(() => foucsInput(formcon.current), 300);
    }
    if (!loading) {
      load();
    }
  }, [loading]);
  function newRecord(options = {}) {
    if (!customwidget.current) return;
    onSubmitBegin();
    cache.current.newRecordOptions = options;
    customwidget.current.submitFormData();
  }
  function onSave(error, { data } = {}) {
    if (error) {
      onSubmitEnd();
      return;
    }
    let hasError;
    isSubmitting.current = true;
    const subListControls = data.filter(item => item.type === 34);
    const isMobile = browserIsMobile();
    if (subListControls.length) {
      const errors = subListControls
        .map(control => ({
          id: control.controlId,
          value:
            control.value &&
            control.value.rows &&
            control.value.rows.length &&
            getSubListError(
              {
                ...control.value,
                rules: _.get(
                  cellObjs.current || {},
                  `${control.controlId}.cell.worksheettable.current.table.state.rules`,
                ),
              },
              _.get(cellObjs.current, `${control.controlId}.cell.controls`) || control.relationControls,
              control.showControls,
              2,
            ),
        }))
        .filter(c => !_.isEmpty(c.value));
      if (errors.length) {
        hasError = true;
        errors.forEach(error => {
          const errorSublist = (cellObjs.current || {})[error.id];
          if (errorSublist) {
            errorSublist.cell.setState({
              error: !_.isEmpty(error.value),
              cellErrors: error.value,
            });
          }
        });
      } else {
        subListControls.forEach(control => {
          const errorSublist = (cellObjs.current || {})[control.controlId];
          if (errorSublist) {
            errorSublist.cell.setState({
              error: false,
              cellErrors: {},
            });
          }
        });
      }
      if (formcon.current && formcon.current.querySelector('.cellControlErrorTip')) {
        hasError = true;
      }
    }
    if (hasError) {
      setErrorVisible(true);
      alert(_l('请正确填写%0', entityName || worksheetInfo.entityName || ''), 3);
      onSubmitEnd();
      return false;
    } else {
      if (requesting) {
        return false;
      }
      setRequesting(true);
      const { autoFill, actionType, continueAdd, isContinue } = cache.current.newRecordOptions || {};
      submitNewRecord({
        appId,
        projectId,
        viewId,
        worksheetId,
        formdata: data
          .filter(c => (isMobile ? true : !isRelateRecordTableControl(c)))
          .concat(
            _.keys(relateRecordData)
              .map(key => ({
                ...relateRecordData[key],
                value: JSON.stringify(
                  formatRecordToRelateRecord(worksheetInfo.template.controls, relateRecordData[key].value),
                ),
              }))
              .filter(_.identity),
          ),
        customwidget,
        setRequesting,
        onSubmitSuccess: ({ rowData, newControls }) => {
          if (actionType === BUTTON_ACTION_TYPE.CONTINUE_ADD || continueAdd || notDialog) {
            alert('保存成功', 1, 1000);
            isSubmitting.current = false;
            if (!autoFill) {
              setFormdata(originFormdata);
              setRelateRecordData({});
            }
            if (newControls) {
              setFormdata(
                (autoFill ? formdata : originFormdata).map(c =>
                  Object.assign(_.find(newControls, nc => nc.controlId === c.controlId) || c, { value: c.value }),
                ),
              );
            }
            setErrorVisible(false);
            setRandom(Math.random().toString());
            foucsInput(formcon.current);
          } else {
            onCancel();
            if (actionType === BUTTON_ACTION_TYPE.OPEN_RECORD) {
              const openViewId = _.get(
                advancedSetting,
                isContinue ? 'continueOpenRecordViewId' : 'submitOpenRecordViewId',
              );
              if (_.isFunction(openRecord)) {
                openRecord(rowData.rowid, openViewId);
              } else {
                openRecordInfo({
                  appId: appId,
                  worksheetId: worksheetId,
                  recordId: rowData.rowid,
                  viewId: openViewId,
                });
              }
            }
          }
          if (viewId) {
            removeFromLocal('tempNewRecord_' + viewId);
          }
          if (_.isFunction(onAdd)) {
            onAdd(rowData);
          }
        },
        ..._.pick(props, [
          'notDialog',
          'addWorksheetRow',
          'customBtn',
          'masterRecord',
          'addType',
          'onSubmitEnd',
          'updateWorksheetControls',
        ]),
      });
    }
  }
  registerFunc({ newRecord });
  const RecordCon = notDialog ? React.Fragment : ScrollView;
  const recordTitle = title || _l('创建%0', entityName || worksheetInfo.entityName || '');
  return (
    <Con>
      {tempNewRecord && (
        <EditingBarCon>
          <EditingBar
            visible={restoreVisible}
            defaultTop={-140}
            visibleTop={8}
            title={_l('有上次未提交的内容，是否恢复？')}
            updateText={_l('恢复')}
            cancelText={_l('丢弃')}
            onUpdate={() => {
              setRestoreVisible(false);
              if (viewId) {
                const parsedData = parseRecordTempValue(tempNewRecord, formdata);
                setRandom(Math.random().toString());
                setFormdata(parsedData.formdata);
                setRelateRecordData(parsedData.relateRecordData);
                removeFromLocal('tempNewRecord', viewId);
              }
            }}
            onCancel={() => {
              setRestoreVisible(false);
              if (viewId) {
                removeFromLocal('tempNewRecord', viewId);
              }
            }}
          />
        </EditingBarCon>
      )}
      <RecordCon>
        {!window.isPublicApp && shareVisible && (
          <Share
            title={_l('新建记录链接')}
            from="newRecord"
            isPublic={visibleType === 2}
            publicUrl={publicShareUrl}
            isCharge={isCharge}
            params={{
              appId,
              viewId,
              worksheetId,
              title: recordTitle,
            }}
            onClose={() => setShareVisible(false)}
          />
        )}
        {showTitle && <div className="newRecordTitle ellipsis Font19 mBottom10">{recordTitle}</div>}
        <div className="customFieldsCon" ref={formcon}>
          <RecordForm
            from={2}
            type="new"
            loading={formLoading || loading}
            recordbase={{
              appId,
              worksheetId,
              viewId,
              from,
              isCharge,
              allowEdit: true,
            }}
            masterRecordRowId={masterRecordRowId || (masterRecord || {}).rowId}
            registerCell={({ item, cell }) => (cellObjs.current[item.controlId] = { item, cell })}
            mountRef={ref => (customwidget.current = ref.current)}
            formFlag={random}
            recordinfo={worksheetInfo}
            formdata={formdata}
            relateRecordData={relateRecordData}
            worksheetId={worksheetId}
            showError={errorVisible}
            onChange={(data, ids, { noSaveTemp } = {}) => {
              if (isSubmitting.current) {
                return;
              }
              setFormdata([...data]);
              if (needCache && viewId && !noSaveTemp && cache.current.formUserChanged) {
                saveToLocal('tempNewRecord', viewId, JSON.stringify(getRecordTempValue(data, relateRecordData)));
              }
            }}
            onSave={onSave}
            onError={() => {
              onSubmitEnd();
            }}
            onRelateRecordsChange={(control, records) => {
              if (!customwidget.current) {
                return;
              }
              customwidget.current.dataFormat.updateDataSource({
                controlId: control.controlId,
                value: String((records || []).length),
                data: records,
              });
              customwidget.current.updateRenderData();
              setFormdata(
                formdata.map(item =>
                  item.controlId === control.controlId ? { ...item, value: String((records || []).length) } : item,
                ),
              );
              const newRelateRecordData = { ...relateRecordData, [control.controlId]: { ...control, value: records } };
              setRelateRecordData(newRelateRecordData);
              if (viewId) {
                saveToLocal('tempNewRecord', viewId, JSON.stringify(getRecordTempValue(formdata, newRelateRecordData)));
              }
            }}
            projectId={projectId || props.projectId}
            onWidgetChange={() => {
              cache.current.formUserChanged = true;
            }}
          />
        </div>
      </RecordCon>
    </Con>
  );
}

NewRecordForm.propTypes = {
  from: PropTypes.number,
  isCharge: PropTypes.bool,
  notDialog: PropTypes.bool,
  appId: PropTypes.string,
  viewId: PropTypes.string,
  worksheetId: PropTypes.string,
  worksheetInfo: PropTypes.shape({}),
  title: PropTypes.string,
  entityName: PropTypes.string,
  showTitle: PropTypes.bool,
  defaultRelatedSheet: PropTypes.shape({}),
  defaultFormData: PropTypes.shape({}),
  defaultFormDataEditable: PropTypes.bool,
  writeControls: PropTypes.arrayOf(PropTypes.shape({})),
  registerFunc: PropTypes.func,
  onError: PropTypes.func,
};

export default NewRecordForm;
