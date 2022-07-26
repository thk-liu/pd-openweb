import React, { Component } from 'react';
import styled from 'styled-components';
import withClickAway from 'ming-ui/decorators/withClickAway';
import update from 'immutability-helper';
import { Checkbox } from 'ming-ui';
import { getControls, filterControls, getOtherSelectField } from '../util';
import { SelectFieldsWrap } from 'src/pages/widgetConfig/styled';
import { getIconByType } from '../../../../util';
import { SYSTEM_CONTROL } from '../../../../config/widget';

const Empty = styled.div`
  color: #9e9e9e;
  padding: 60px 0;
  text-align: center;
  background-color: #fff;
`;

@withClickAway
export default class SelectFields extends Component {
  static propTypes = {};
  static defaultProps = {};
  state = {
    searchValue: '',
  };
  // 省略掉自身和循环引用
  omitSelfAndNest = controls => {
    const { data } = this.props;
    return _.filter(controls, item => {
      try {
        const defaultValue = JSON.parse(_.get(item, ['advancedSetting', 'defsource']) || '[]');
        // 去除循环引用
        if (_.some(defaultValue, item => _.includes([data.controlId], item.cid))) {
          return false;
        }
      } catch (error) {
        return false;
      }
      return item.controlId !== data.controlId;
    });
  };
  handleChange = e => {
    const { value } = e.target;
    this.setState({ searchValue: value });
  };
  filterFieldList = () => {
    const { from, globalSheetInfo, controls, data = {} } = this.props;
    const subListControls = this.omitSelfAndNest(controls) || [];
    const globalSheetControls = this.omitSelfAndNest(this.props.globalSheetControls);
    const { worksheetId } = globalSheetInfo;
    const { searchValue } = this.state;
    const initSheetList =
      from === 'subList'
        ? [
            { id: worksheetId, name: _l('主记录') },
            { id: 'current', name: _l('当前子表记录') },
          ]
        : [{ id: 'current', name: _l('当前记录') }];
    // 关联多条----关联单条、多条（列表除外）
    const filterSubListControls = filterControls(data, subListControls);
    // 获取当前记录和关联表控件
    const sheetList = _.includes(['customCreate'], from)
      ? initSheetList
      : initSheetList.concat(
          filterSubListControls.map(item => ({
            id: item.controlId,
            name: item.type === 35 ? _l('级联选择 “%0”', item.controlName) : _l('关联记录 “%0”', item.controlName),
          })),
        );
    // 获取当前表的控件
    const fieldList = {
      current: getControls({ data, controls: subListControls, isCurrent: true }),
      [worksheetId]: getControls({ data, controls: globalSheetControls, isCurrent: true }),
    };
    // 获取关联表控件下的所有符合条件的字段
    sheetList.slice(initSheetList.length).forEach(({ id }) => {
      const relateSheetControl = _.find(subListControls, ({ controlId }) => controlId === id) || {};

      let relationControls = _.get(relateSheetControl, 'relationControls') || [];
      // 如果relationControl没有返回系统字段， 则手动添加上
      if (!relationControls.some(item => item.controlId === 'ctime')) {
        relationControls = relationControls.concat(SYSTEM_CONTROL);
      }

      const filteredRelationControls = getControls({ data, controls: relationControls });
      fieldList[id] = filteredRelationControls;
    });
    if (!searchValue) return { sheetList, filteredList: fieldList };
    const filteredList = {};
    _.keys(fieldList).forEach(key => {
      const item = fieldList[key];
      filteredList[key] = item.filter(field => _.includes(field.controlName, searchValue));
    });
    return { sheetList, filteredList };
  };
  isMultiUser = data => {
    return data.type === 26 && data.enumDefault === 1;
  };
  handleMultiUserClick = para => {
    const { checked, relateSheetControlId, fieldId } = para;
    const { onMultiUserChange, dynamicValue } = this.props;
    const newValue = checked
      ? update(dynamicValue, {
          $push: [{ cid: fieldId, rcid: relateSheetControlId, staticValue: '' }],
        })
      : update(dynamicValue, {
          $splice: [[_.findIndex(dynamicValue, item => item.cid === fieldId && item.rcid === relateSheetControlId), 1]],
        });
    onMultiUserChange(newValue);
  };
  getControlCount = list => {
    return _.keys(list).reduce((p, c) => p + (list[c] || []).length, 0);
  };
  getOtherCount = data => {
    return data.reduce((p, c) => {
      return (p.list || []).length + (c.list || []).length;
    }, 0);
  };
  render() {
    const { searchValue } = this.state;
    const { onClick, data, dynamicValue } = this.props;
    const otherList = getOtherSelectField(data, searchValue);
    const { sheetList, filteredList } = this.filterFieldList();
    const filteredControlCount = this.getControlCount(filteredList) + this.getOtherCount(otherList);
    return (
      <SelectFieldsWrap>
        <div className="search">
          <i className="icon-search Gray_9e" />
          <input value={searchValue} onChange={this.handleChange} placeholder={_l('搜索字段')}></input>
        </div>
        <div className="fieldsWrap">
          {sheetList.map(({ id: recordId, name }) => {
            const list = filteredList[recordId];
            return list && list.length > 0 ? (
              <ul className="relateSheetList">
                <li>
                  <div className="title">
                    <span>{name}</span>
                  </div>
                  <ul className="fieldList">
                    {list.map(({ type, controlName, controlId, id }) => {
                      const ids = {
                        type,
                        relateSheetControlId: recordId === 'current' ? '' : recordId,
                        fieldId: controlId || id,
                      };
                      return this.isMultiUser(data) ? (
                        <li className="overflow_ellipsis">
                          <Checkbox
                            size="small"
                            checked={_.some(
                              dynamicValue,
                              item => item.cid === ids.fieldId && item.rcid === ids.relateSheetControlId,
                            )}
                            onClick={checked => {
                              this.handleMultiUserClick({
                                checked: !checked,
                                ...ids,
                              });
                            }}
                          >
                            <i className={`icon-${getIconByType(type)}`}></i>
                            <span className="overflow_ellipsis">{controlName}</span>
                          </Checkbox>
                        </li>
                      ) : (
                        <li className="overflow_ellipsis" onClick={() => onClick(ids)}>
                          <i className={`icon-${getIconByType(type)}`}></i>
                          <span className="overflow_ellipsis">{controlName}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              </ul>
            ) : null;
          })}
          {otherList.map(({ list, name }) => {
            return list.length > 0 ? (
              <ul className="relateSheetList">
                <li>
                  <div className="title">
                    <span>{name}</span>
                  </div>
                  <ul className="fieldList">
                    {list.map(({ text, id }) => {
                      return (
                        <li className="overflow_ellipsis" onClick={() => onClick({ fieldId: id })}>
                          <span className="overflow_ellipsis">{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              </ul>
            ) : null;
          })}
          {!filteredControlCount && <Empty>{searchValue ? _l('暂无搜索结果') : _l('没有可用字段')}</Empty>}
        </div>
      </SelectFieldsWrap>
    );
  }
}
