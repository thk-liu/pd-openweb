﻿const StructureController = require('src/api/structure');

const COMPANY_FAKE_ACCOUNTID = '';

import Config from '../config';
// 打开关闭节点折叠
export const OPEN_COLLAPSE = 'OPEN_COLLAPSE';
export const CLOSE_COLLAPSE = 'CLOSE_COLLAPSE';
// 添加实体
export const ADD_STRUCTURES = 'ADD_STRUCTURES';
export const REMOVE_STRUCTURE = 'REMOVE_STRUCTURE';
export const REPLACE_STRUCTURE = 'REPLACE_STRUCTURE';

// 替换相关的action
export const ADD_PARENT_CHILDREN = 'ADD_PARENT_CHILDREN';
export const REMOVE_PARENT_CHILDREN = 'REMOVE_PARENT_CHILDREN';
export const UPDATE_CURRENT_CHILDREN = 'UPDATE_CURRENT_CHILDREN';

export const FETCH_PARENT = 'FETCH_PARENT';

export const SUBORDINATES_REQUEST = 'SUBORDINATES_REQUEST';
export const SUBORDINATES_SUCCESS = 'SUBORDINATES_SUCCESS';
export const SUBORDINATES_FAILURE = 'SUBORDINATES_FAILURE';
// 更新下属数组
export const UPDATE_ENTITY_CHILDS = 'UPDATE_ENTITY_CHILDS';

// 更新高亮节点
export const CLEAR_HIGHLIGHT = 'CLEAR_HIGHLIGHT';
export const UPDATE_HIGHLIGHT = 'UPDATE_HIGHLIGHT';

export const UPDATE_IS_LOADING = 'UPDATE_IS_LOADING';

// 公司节点
export const initRoot = () => dispatch => {
  const project = Config.getProjectInfo();
  dispatch({
    type: ADD_STRUCTURES,
    payload: {
      source: [
        {
          projectId: Config.projectId,
          fullname: project.companyName,
          accountId: COMPANY_FAKE_ACCOUNTID,
        },
      ],
    },
  });
};

export const updateCollapse = (id = COMPANY_FAKE_ACCOUNTID, open = true) => ({
  type: open ? OPEN_COLLAPSE : CLOSE_COLLAPSE,
  payload: {
    id,
  },
});

export const addSubordinates =
  ({ id, accounts }) =>
  dispatch => {
    StructureController.addStructure({
      projectId: Config.projectId,
      isTop: id === COMPANY_FAKE_ACCOUNTID,
      parentId: id,
      accountIds: _.map(accounts, _ => _.accountId),
    }).then(res => {
      if (res && res.success) {
        const { failedAccountIds } = res;
        let successAccounts = accounts;
        if (failedAccountIds && failedAccountIds.length) {
          successAccounts = _.filter(accounts, account => failedAccountIds.indexOf(account.accountId) === -1);
        }
        // 添加实体
        dispatch({
          type: ADD_STRUCTURES,
          payload: {
            source: successAccounts,
          },
        });
        // 添加实体上下级
        dispatch({
          type: UPDATE_ENTITY_CHILDS,
          payload: {
            id,
            source: successAccounts,
          },
        });

        dispatch(fetchSubordinates(_.map(successAccounts, _ => _.accountId))).then(function () {
          // 打开当前节点
          dispatch(updateCollapse(id));
        });
      } else {
        alert(_l('操作失败', 2));
      }
    });
  };

/**
 * 替换当前节点
 * @param { object } params
 * @param { object } params.account userModel
 * @param { string } params.replacedAccountId 替换的节点
 * @param { string } params.parentId 替换的节点的父节点 update children用
 */
export const replaceStructure =
  ({ account, parentId, replacedAccountId }) =>
  dispatch => {
    const { accountId } = account;
    StructureController.replaceUserStructure({
      projectId: Config.projectId,
      replacedAccountId,
      accountId,
    }).then(res => {
      if (res) {
        const { accountId } = account;
        // 添加实体
        dispatch({
          type: ADD_STRUCTURES,
          payload: {
            source: [account],
          },
        });
        // 父实体修改
        // 删除
        dispatch({
          type: REMOVE_PARENT_CHILDREN,
          payload: {
            id: parentId,
            removeId: replacedAccountId,
          },
        });
        // 添加
        dispatch({
          type: ADD_PARENT_CHILDREN,
          payload: {
            id: parentId,
            addId: accountId,
          },
        });
        // 下属替换
        dispatch({
          type: UPDATE_CURRENT_CHILDREN,
          payload: {
            id: accountId,
            replacedAccountId,
          },
        });
      } else {
        alert(_l('操作失败', 2));
      }
    });
  };

/**
 * 移除节点
 */
export const removeStructure =
  ({ parentId, accountId }) =>
  dispatch => {
    StructureController.removeParentID({
      projectId: Config.projectId,
      accountId,
    }).then(res => {
      if (res) {
        // 父实体修改
        dispatch({
          type: REMOVE_PARENT_CHILDREN,
          payload: {
            id: parentId,
            removeId: accountId,
          },
        });
        // 实体集删除
        dispatch({
          type: REMOVE_STRUCTURE,
          payload: {
            id: accountId,
          },
        });
      } else {
        alert(_l('操作失败', 2));
      }
    });
  };

const fetchRootSubordinates = parentId => dispatch => {
  dispatch({ type: SUBORDINATES_REQUEST, payload: { id: parentId } });
  dispatch({ type: UPDATE_IS_LOADING, payload: { data: true } });
  return StructureController.getProjectStructuresTop({
    projectId: Config.projectId,
    isDirect: true,
    isGetSubordinate: true,
  }).then(
    source => {
      dispatch({ type: ADD_STRUCTURES, payload: { source } });
      dispatch({ type: UPDATE_ENTITY_CHILDS, payload: { id: parentId, source } });
      dispatch({ type: UPDATE_IS_LOADING, payload: { data: false } });
    },
    error => {
      dispatch({ type: SUBORDINATES_FAILURE, payload: { id: parentId, error } });
      dispatch({ type: UPDATE_IS_LOADING, payload: { data: false } });
    },
  );
};

const fetchSubordinates = args => dispatch => {
  const parentIds = _.isArray(args) ? args : [args];
  return StructureController.getSubordinateByAccountIds({
    projectId: Config.projectId,
    accountIds: parentIds,
    isDirect: true,
    isGetParent: false,
  }).then(source => {
    dispatch({ type: ADD_STRUCTURES, payload: { source } });
    return source;
  });
};

export const fetchNode =
  (parentId = COMPANY_FAKE_ACCOUNTID) =>
  dispatch => {
    if (parentId !== COMPANY_FAKE_ACCOUNTID) {
      return dispatch(fetchSubordinates(parentId));
    } else {
      return dispatch(fetchRootSubordinates(parentId));
    }
  };

/**
 * 获取上司数组
 */
export const fetchParent =
  (id, isDirect = false) =>
  (dispatch, getState) => {
    return StructureController.getParentsByAccountId({
      accountId: id,
      projectId: Config.projectId,
      isDirect,
    }).then(parents => {
      if (parents && parents.length) {
        const parentIds = _.map(parents, p => p.accountId);
        dispatch(fetchSubordinates(parentIds))
          .then(source => {
            const users = getState().entities.users;
            const accountIds = _.reduce(
              source,
              (result, { accountId }) => {
                const subordinates = (users[accountId] || {}).subordinates;
                return result.concat(subordinates || []);
              },
              [],
            );
            return dispatch(fetchNode(accountIds));
          })
          .then(() => {
            // 获取数据完后全部展开父节点
            _.forEach(parentIds, id => {
              dispatch(updateCollapse(id));
            });

            dispatch({
              type: UPDATE_HIGHLIGHT,
              payload: {
                highLightId: id,
              },
            });
          });
      } else {
        dispatch({
          type: UPDATE_HIGHLIGHT,
          payload: {
            highLightId: id,
          },
        });
      }
    });
  };
