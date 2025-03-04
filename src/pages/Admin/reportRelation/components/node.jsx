import React, { Component } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { connect } from 'react-redux';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';

import { fetchNode, updateCollapse, addSubordinates, replaceStructure, removeStructure } from '../actions';
import { selectUser } from '../common';
import Confirm from 'confirm';

import { Icon, LoadDiv } from 'ming-ui';
import Item from './item';
import NoData from './noData';
import styled from 'styled-components';

const LoadWrap = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const arrayEqual = function (arr1, arr2) {
  var length = arr1.length;
  if (length !== arr2.length) return false;
  for (var i = 0; i < length; i++) if (arr1[i] !== arr2[i]) return false;
  return true;
};

class Node extends Component {
  static propTypes = {
    subordinates: PropTypes.arrayOf(PropTypes.string),
    isFirst: PropTypes.bool,
    isLast: PropTypes.bool,
  };

  static defaultProps = {
    isFirst: true,
    isLast: true,
  };

  renderChilds() {
    const { subordinates, collapsed, id, auth } = this.props;
    const len = subordinates && subordinates.length;
    if (subordinates && len && !collapsed) {
      return (
        <div className="childNodeList">
          {subordinates.map((child, index) => {
            const _props = {
              id: child,
              parentId: id,
              level: this.props.level + 1,
              isFirst: index === 0,
              isLast: index === len - 1,
              auth,
            };
            return <ConnectedNode {..._props} key={_props.id} />;
          })}
        </div>
      );
    }
  }

  toggle() {
    const { dispatch, id, collapsed, subordinates } = this.props;
    dispatch(updateCollapse(id, collapsed));
    if (collapsed && subordinates) {
      dispatch(fetchNode(subordinates));
    }
  }

  renderToggleButton() {
    const { subordinates, collapsed } = this.props;
    const len = subordinates && subordinates.length;
    if (subordinates && len) {
      const font = collapsed ? 'plus' : 'minus';
      return (
        <Icon
          className="toggleButton"
          icon={font}
          onClick={() => {
            this.toggle();
          }}
        />
      );
    }
  }

  add() {
    const { id, dispatch } = this.props;
    selectUser({
      title: _l('添加下属'),
      accountId: id,
      callback: accounts => {
        dispatch(
          addSubordinates({
            id,
            accounts,
          }),
        );
      },
    });
  }

  replace() {
    const { id, parentId, dispatch } = this.props;
    selectUser({
      title: _l('替换成员'),
      accountId: id,
      unique: true,
      callback: accounts => {
        dispatch(
          replaceStructure({
            parentId,
            account: accounts[0],
            replacedAccountId: id,
          }),
        );
      },
    });
  }

  remove() {
    const { id, parentId, fullname, dispatch } = this.props;
    const confirm = new Confirm(
      {
        title: _l('确认移除 %0 ?', fullname),
        content: '移除后，其下属成员也将从汇报关系中移除',
        cancel: _l('取消'),
        confirm: _l('确认'),
      },
      function () {
        dispatch(
          removeStructure({
            parentId,
            accountId: id,
          }),
        );
      },
    );
  }

  renderItem() {
    const { auth, id, fullname, avatar, department, job, status, subordinates, isHighLight, dispatch } = this.props;
    const itemProps = {
      id,
      fullname,
      avatar,
      department,
      job,
      subordinates,
      status,
      isHighLight,
      auth,
      add: this.add.bind(this),
      replace: this.replace.bind(this),
      remove: this.remove.bind(this),
    };

    return <Item {...itemProps} />;
  }

  handleSearchHighLight() {
    if (this.node && this.props.isHighLight) {
      const top = $(this.node).offset().top;
      $.publish('REPORT_RELATION_SCROLLTOP', { top });
    }
  }

  componentDidMount() {
    const { level } = this.props;
    if (level === 1) {
      // 默认打开公司下第一层节点
      this.toggle();
    }
    this.handleSearchHighLight();
  }

  componentDidUpdate() {
    this.handleSearchHighLight();
  }

  shouldComponentUpdate(nextProps) {
    // const isSubordinateChange = !arrayEqual(this.props.subordinates || [], nextProps.subordinates || []);
    // const isCollapseChange = this.props.collapsed !== nextProps.collapsed;
    return !_.isEqual(this.props, nextProps);
  }

  render() {
    const { isFirst, isLast, id, subordinates, auth, isLoading } = this.props;
    if (isLoading) {
      return (
        <LoadWrap>
          <LoadDiv />
        </LoadWrap>
      );
    }
    if (!id) {
      return (
        <div className="rootNodeItem">
          <div className="Font24 pLeft8">
            <Icon icon="company" className="TxtMiddle Gray_9e" />
            <span className="Font16 TxtMiddle mLeft10 mRight10">{this.props.fullname}</span>
            {auth ? (
              <span className="Hand Font14 TxtMiddle Gray_9e" onClick={this.add.bind(this)}>
                <Icon className="Font24 mRight10 TxtMiddle" icon="add-member2" />
                <span className="TxtMiddle">{_l('添加下属')}</span>
              </span>
            ) : null}
          </div>
          {subordinates && subordinates.length ? <div className="rootNodeSheet" /> : <NoData />}
          {this.renderChilds()}
        </div>
      );
    } else {
      return (
        <div
          className={cx('nodeItem', { last: isLast, first: isFirst })}
          ref={el => {
            this.node = el;
          }}
        >
          {this.renderItem()}
          {this.renderToggleButton()}
          {this.renderChilds()}
        </div>
      );
    }
  }
}

const ConnectedNode = connect((state, ownProps) => {
  const {
    entities: { users },
    highLightId,
    isLoading,
  } = state;
  const user = users[ownProps.id];
  return {
    ...user,
    level: ownProps.level,
    isHighLight: highLightId === ownProps.id,
    isLoading,
  };
})(Node);

ConnectedNode.defaultProps = {
  id: '',
  level: 0, // 层级  公司 为0 递增
};

export default ConnectedNode;
