import React from 'react';
import PropTypes from 'prop-types';

import RoleController from 'src/api/role';
import LoadDiv from 'ming-ui/components/LoadDiv';
import Dialog from 'ming-ui/components/Dialog';
import UserHead from 'src/pages/feed/components/userHead';

import './style.less';

export default class ApplyForRole extends React.Component {
  constructor() {
    super();
    this.state = {
      pageIndex: 1,
      pageSize: 10,
      totalCount: null,
      list: null,
      isLoading: false,
    };

    this.fetchData = this.fetchData.bind(this);
  }

  componentWillMount() {
    this.fetchData();
  }

  componentDidUpdate() {
    const { totalCount, pageIndex, pageSize } = this.state;
    if (this.pager) {
      $(this.pager)
        .show()
        .Pager({
          pageIndex,
          pageSize,
          count: totalCount,
          changePage: pageIndex => {
            this.setState({ pageIndex }, this.fetchData);
          },
        });
    }
  }

  fetchData() {
    const { projectId } = this.props;
    const { pageIndex, pageSize } = this.state;
    this.setState({
      isLoading: true,
    });
    this.promise = RoleController.getUnauditedUserDetail({
      projectId,
      pageIndex,
      pageSize,
    })
      .then(data => {
        if (data) {
          this.setState({
            totalCount: data.allCount,
            list: data.list,
            isLoading: false,
          });
        } else {
          return $.Deferred().reject().promise();
        }
      })
      .fail(() => {
        this.setState({
          isLoading: false,
        });
      });
  }

  renderUsers() {
    const { projectId } = this.props;
    const { list } = this.state;

    return (
      <React.Fragment>
        {list && list.length ? (
          _.map(list, user => {
            return (
              <tr key={user.accountId}>
                <td>
                  <UserHead
                    className="avatarImg"
                    user={{ userHead: user.avatar, accountId: user.accountId }}
                    size={30}
                  />
                </td>
                <td>{user.fullName}</td>
                <td>{user.departName}</td>
                <td>{user.profession}</td>
                <td>{user.roleName}</td>
                <td>
                  <span
                    className="Hand ThemeColor3"
                    onClick={() => {
                      RoleController.agreeUserToRole({
                        accountId: user.accountId,
                        roleId: user.roleId,
                        projectId,
                      })
                        .then(data => {
                          if (data) {
                            alert(_l('操作成功'), 1);
                            this.fetchData();
                          } else {
                            return $.Deferred().reject().promise();
                          }
                        })
                        .fail(function () {
                          alert(_l('操作失败'), 2);
                        });
                    }}
                  >
                    {_l('授予角色')}
                  </span>
                  <span
                    className="Hand Red mLeft24"
                    onClick={() => {
                      RoleController.refuseUserToRole({
                        accountId: user.accountId,
                        roleId: user.roleId,
                        projectId,
                      })
                        .then(data => {
                          if (data) {
                            alert(_l('操作成功'), 1);
                            this.fetchData();
                          } else {
                            return $.Deferred().reject().promise();
                          }
                        })
                        .fail(function () {
                          alert(_l('操作失败'), 2);
                        });
                    }}
                  >
                    {_l('拒绝')}
                  </span>
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan="6" className="listEmpty">
              <div>
                <span className="icon-empty_member mainIcon" />
              </div>
              <div className="mTop20">{_l('暂无申请')}</div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  }

  render() {
    const { visible, onOk, onClose } = this.props;
    const { isLoading, list, totalCount, pageSize } = this.state;
    const dialogProps = {
      className: 'applyRoleDialog',
      width: 850,
      height: 668,
      title: '申请角色请求',
      visible,
      onCancel: onClose,
      onOk: onOk,
      anim: false,
      footer: null,
    };

    return (
      <Dialog {...dialogProps}>
        {isLoading ? (
          <LoadDiv />
        ) : (
          <React.Fragment>
            <div className="roleApplyContainer">
              <table className="w100">
                <thead className="roleUserTitle">
                  <tr>
                    <th className="userAvatar" />
                    <th className="userName">{_l('姓名')}</th>
                    <th className="userDepartment">{_l('部门')}</th>
                    <th className="userProfession">{_l('职位')}</th>
                    <th className="userApplyRole">{_l('申请角色')}</th>
                    <th className="userOperation">{_l('操作')}</th>
                  </tr>
                </thead>
                <tbody>{isLoading ? null : this.renderUsers()}</tbody>
              </table>
              {isLoading ? <LoadDiv /> : null}
              {!isLoading && list && totalCount > pageSize ? (
                <div
                  ref={el => {
                    this.pager = el;
                  }}
                />
              ) : null}
            </div>
          </React.Fragment>
        )}
      </Dialog>
    );
  }
}
