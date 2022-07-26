import PropTypes from 'prop-types';
import React, { Component } from 'react';
import ReactDom from 'react-dom';
import classNames from 'classnames';
import 'md.select';
import intlTelInput from '@mdfe/intl-tel-input';
import '@mdfe/intl-tel-input/build/css/intlTelInput.min.css';
import utils from '@mdfe/intl-tel-input/build/js/utils';
import 'dialogSelectUser';
import Act from './act';
import DialogSelectDept from 'dialogSelectDept';
import DialogSelectJob from 'src/components/DialogSelectJob';
import copy from 'copy-to-clipboard';
var workSiteController = require('src/api/workSite');
var importUserController = require('src/api/importUser');
import { Icon, Radio } from 'ming-ui';
import { encrypt } from 'src/util';
import RegExp from 'src/util/expression';
import { Tooltip } from 'antd';

const checkUser = ([input, iti]) => {
  if (!input.value) {
    return {
      msg: _l('请输入手机或者邮箱'),
    };
  }
  if (isNaN(Number(input.value))) {
    if (RegExp.isEmail(input.value)) {
      return null;
    } else {
      return {
        msg: _l('邮箱填写错误'),
      };
    }
  } else {
    if (iti.isValidNumber()) {
      return null;
    } else {
      return {
        msg: _l('手机号填写错误'),
      };
    }
  }
};

const checkFuncs = {
  userName: userName => {
    if ($.trim(userName) === '') {
      return {
        msg: _l('姓名不能为空'),
      };
    }
  },
  user: user => {
    if (!(user && user.accountId !== '')) {
      return {
        msg: _l('姓名不能为空'),
      };
    }
  },
  invite: checkUser,
  autonomously: checkUser,
  autonomouslyPasswrod: password => {
    const { md = {} } = window;
    const { global = {} } = md;
    const { SysSettings = {} } = global;
    const { passwordRegexTip, passwordRegex } = SysSettings;
    if ($.trim(password) === '') {
      return {
        msg: _l('密码不能为空'),
      };
    }
    if (!RegExp.isPasswordRule(password, passwordRegex)) {
      return {
        msg: passwordRegexTip || _l('密码过于简单，至少8~20位且含字母+数字'),
      };
    }
  },
  contactPhone: tel => {
    if (!tel) return;
    if (!RegExp.isTel(tel) && !RegExp.isMobile(tel)) {
      return {
        msg: _l('工作电话格式不正确'),
      };
    }
  },
};

const inviteCallback = (data, callback, copyText, isClear) => {
  const RESULTS = {
    FAILED: 0,
    SUCCESS: 1,
    OVERINVITELIMITCOUNT: 4,
  };
  const text = copyText ? _l('创建') : _l('邀请');
  if (!data || data.actionResult == RESULTS.FAILED) {
    alert(_l('%0失败', text), 2);
  } else if (data.actionResult == RESULTS.OVERINVITELIMITCOUNT) {
    alert(_l('超过%0数量限制', text), 3);
  } else {
    const { failUsers, successUsers, existsUsers, forbidUsers, successCount } = data;
    if (failUsers && failUsers.length) {
      alert(_l('%0失败', text), 2);
    } else if (successUsers || successCount) {
      copyText && copy(copyText);
      copyText ? alert(_l('创建成功, 账号密码已复制'), 1) : alert(_l('邀请成功'), 1);

      if (!isClear) {
        callback();
      }
    } else if (existsUsers) {
      alert(_l('手机号/邮箱已存在'), 2);
    } else if (forbidUsers) {
      alert(_l('账号来源类型受限'), 2);
    }
  }
};

const TextInput = props => {
  const { label, editable, isRequired, value, placeholder, onChange, onBlur, onFocus, error, type, maxLength } = props;
  const inputProps = {
    value,
    placeholder,
    onChange,
    onBlur,
    onFocus,
    type,
  };
  return (
    <div className="formGroup">
      <span className="formLabel">
        {label}
        {isRequired ? <span className="TxtMiddle Red">*</span> : null}
      </span>
      {editable ? (
        <input
          type="text"
          className={classNames('formControl', { error })}
          {...inputProps}
          maxLength={maxLength || Infinity}
        />
      ) : null}
      {props.children}
      <span
        className={classNames('Block Red LineHeight25', {
          Hidden: error && error.msg,
          pTop25: !error,
        })}
      >
        {error && error.msg}
      </span>
    </div>
  );
};

TextInput.defaultProps = {
  isRequired: false,
  editable: true,
  isError: false,
};

TextInput.propTypes = {
  label: PropTypes.string,
  field: PropTypes.string,
  isRequired: PropTypes.bool,
  isError: PropTypes.bool,
  editable: PropTypes.bool,
  value: PropTypes.string,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
};

const initialState = {
  inviteType: 'invite',
  editable: true,
  moreInfo: false,
  errors: {},
  isUploading: false,

  user: {},
  userName: '',
  workSiteId: '',
  invite: '',
  autonomously: '',
  autonomouslyPasswrod: '',
  jobId: '',
  jobNumber: '',
  contactPhone: '',
};

class Main extends Component {
  constructor(props) {
    super(props);
    this.state = _.merge({}, initialState, {
      departmentInfos: this.props.departmentInfos || [], //部门信息
      jobInfos: this.props.jobInfos || [], //职位信息
      workSites: [],
      workSitesLoaded: false,
      jobsLoaded: false,
      isShowAct: false,
      idAct: '',
    });
    this.closeDialog = props.closeDialog;
    this.dialogCenter = props.dialogCenter;
    this.changeInviteType = this.changeInviteType.bind(this);
    this.dialogSelectUserHandler = this.dialogSelectUserHandler.bind(this);
    this.clearSelectUser = this.clearSelectUser.bind(this);
    this.toggleShowMoreInfo = this.toggleShowMoreInfo.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleFieldInput = this.handleFieldInput.bind(this);
    this.clearError = this.clearError.bind(this);
  }

  componentDidMount() {
    this.dialogCenter();
    this.itiInviteFn();
    // this.itiAutonomouslyFn();
  }

  componentDidUpdate() {
    const { moreInfo, inviteType, workSites, workSitesLoaded } = this.state;
    inviteType === 'mobile' && this.itiFn();
    // !this.itiAutonomously && this.itiAutonomouslyFn();
    if (!moreInfo) return;
    this.bindWorksiteSelect();
  }

  componentWillUnmount() {
    this.itiInvite.destroy();
    this.itiAutonomously.destroy();
  }

  itiInviteFn = () => {
    this.itiInvite && this.itiInvite.destroy();
    this.itiInvite = intlTelInput(this.invite, {
      customPlaceholder: '',
      autoPlaceholder: 'off',
      initialCountry: 'cn',
      loadUtils: '',
      preferredCountries: ['cn'],
      utilsScript: utils,
      separateDialCode: true,
    });
    $('.iti__flag-container').hide();
    $(this.invite).css({ 'padding-left': '15px' });
  };

  itiAutonomouslyFn = () => {
    this.itiAutonomously && this.itiAutonomously.destroy();
    this.itiAutonomously = intlTelInput(this.autonomously, {
      customPlaceholder: '',
      autoPlaceholder: 'off',
      initialCountry: 'cn',
      loadUtils: '',
      preferredCountries: ['cn'],
      utilsScript: utils,
      separateDialCode: true,
    });
    $('.iti__flag-container').hide();
    $(this.autonomously).css({ 'padding-left': '15px' });
  };

  bindWorksiteSelect() {
    const _this = this;
    const { workSites, workSitesLoaded } = this.state;
    const { projectId } = this.props;
    var dfd = $.Deferred();
    if (!workSitesLoaded) {
      workSiteController
        .getWorkSites({
          projectId: projectId,
          sortField: 1,
          sortType: 1,
          pageSize: 1000,
        })
        .then(
          data => {
            const { list } = data;
            const dataArr = _.map(list || [], workSite => ({
              id: workSite.workSiteId,
              name: workSite.workSiteName,
            }));
            this.setState({
              workSites: dataArr || [],
              workSitesLoaded: true,
            });
            dfd.resolve(dataArr);
          },
          () => {
            this.setState({
              workSitesLoaded: true,
            });
          },
        );
    } else {
      dfd.resolve(workSites);
    }
    dfd.then(data => {
      $(this.workSiteInput).MDSelect({
        dataArr: data,
        showType: 4,
        defaultOptionText: _l('请选择'),
        onChange(value) {
          _this.setState({
            workSiteId: value,
          });
        },
      });
    });
  }

  changeInviteType(type) {
    return () => {
      this.clearError('autonomously')();
      this.clearError('invite')();
      this.setState({ inviteType: type, invite: '', autonomously: '' });
      setTimeout(() => {
        if (type === 'invite') {
          this.itiInviteFn();
        } else {
          this.itiAutonomouslyFn();
        }
      }, 0);
    };
  }

  clearSelectUser() {
    return () => {
      this.setState({
        user: {},
        editable: true,
        errors: {},
      });
    };
  }

  toggleShowMoreInfo() {
    return () => {
      const { moreInfo } = this.state;
      this.setState({
        moreInfo: !moreInfo,
        jobId: '',
        workSiteId: '',
        jobNumber: '',
        contactPhone: '',
      });
    };
  }

  handleSubmit(isClear) {
    return () => {
      this.submitInfo(isClear);
    };
  }

  clearError(field) {
    return () => {
      const { errors } = this.state;
      delete errors[field];
      this.setState({ errors });
    };
  }

  handleFieldInput(field) {
    return e => {
      const isInvite = field === 'invite';
      const isAutonomously = field === 'autonomously';
      const currentEl = isInvite ? this.invite : this.autonomously;
      if (isInvite || isAutonomously) {
        const isMobile = e.target.value.length > 3 && !isNaN(Number(e.target.value));
        this.setState({
          [field]: isMobile
            ? isInvite
              ? this.itiInvite.getNumber()
              : this.itiAutonomously.getNumber()
            : e.target.value,
        });
      } else {
        this.setState({
          [field]: e.target.value,
        });
      }
      if (isInvite || isAutonomously) {
        if (e.target.value.length > 3 && !isNaN(Number(e.target.value))) {
          $(currentEl)
            .parent()
            .removeClass('phoneWrapper');
          $('.iti__flag-container').show();
          $(currentEl).css({ 'padding-left': '80px' });
        } else {
          $('.iti__flag-container').hide();
          $(currentEl)
            .parent()
            .addClass('phoneWrapper');
        }
      }
    };
  }

  handleFieldBlur(field) {
    return e => {
      let value;
      let isInvite = field === 'invite';
      let isAutonomously = field === 'autonomously';
      if (typeof e !== 'undefined') {
        value =
          isInvite || isAutonomously
            ? isInvite
              ? [this.invite, this.itiInvite]
              : [this.autonomously, this.itiAutonomously]
            : e.target.value;
      } else {
        value =
          isInvite || isAutonomously
            ? isInvite
              ? [this.invite, this.itiInvite]
              : [this.autonomously, this.itiAutonomously]
            : this.state[field];
      }
      const errors = this.state.errors || {};
      const checkResult = checkFuncs[field](value);
      if (checkResult) {
        errors[field] = checkResult;
      }
      this.setState({
        errors: errors,
      });
    };
  }

  submitInfo(isClear) {
    const state = this.state;
    const { isUploading, autonomously, autonomouslyPasswrod } = state;
    if (isUploading) return false;
    if (state.editable) {
      this.handleFieldBlur('userName')();
      if (state.inviteType === 'autonomously') {
        this.handleFieldBlur('autonomously')();
        this.handleFieldBlur('autonomouslyPasswrod')();
      } else {
        this.handleFieldBlur('invite')();
      }
    }
    if (state.errors && _.keys(state.errors).length) {
      return false;
    } else {
      const { projectId } = this.props;

      const { editable, inviteType, departmentInfos = [], jobInfos = [], jobNumber, workSiteId, contactPhone } = state;
      const copyText =
        inviteType === 'autonomously'
          ? `${_l('登录账号')}: ${autonomously} ${_l('密码')}: ${autonomouslyPasswrod}`
          : '';
      const params = {
        projectId,
        accountId: '',
        account: '',
        jobIds: jobInfos.map(it => it.jobId).join(';'),
        departmentIds: departmentInfos.map(it => it.departmentId).join(';'),
        jobNumber,
        workSiteId,
        contactPhone,
        verifyType: inviteType === 'invite' ? 0 : 1,
      };
      if (editable) {
        params.fullname = state.userName;
        params.account = inviteType === 'invite' ? state.invite : state.autonomously;
      } else {
        params.accountId = state.user.accountId;
      }
      if (state.inviteType === 'autonomously') {
        params.password = encrypt(state.autonomouslyPasswrod);
      }
      this.setState({
        isUploading: true,
        departmentInfos: [],
        jobInfos: [],
      });
      importUserController
        .inviteUser(params)
        .then(data => {
          inviteCallback(
            data,
            isClear
              ? () => {
                  this.autonomously.value = '';
                  this.setState({ autonomouslyPasswrod: '' });
                }
              : this.props.closeDialog,
            copyText,
            isClear,
          );
        })
        .always(() => {
          this.setState(_.merge({}, this.state, initialState, { inviteType: state.inviteType }));
          if (this.mobile) {
            this.mobile.value = '';
          }
        });
    }
  }

  dialogSelectUserHandler(e) {
    const { projectId } = this.props;
    const _this = this;
    $({}).dialogSelectUser({
      title: _l('邀请成员'),
      showMoreInvite: false,
      SelectUserSettings: {
        filterProjectId: projectId,
        unique: true,
        callback(userObj) {
          _this.setState({
            user: userObj[0],
            editable: false,
            errors: {},
          });
        },
      },
    });
  }

  // 添加部门
  dialogSelectDeptFn = e => {
    const { projectId, departmentId } = this.props;
    const { departmentInfos } = this.state;
    const _this = this;
    new DialogSelectDept({
      projectId,
      unique: false,
      selectedDepartment: departmentInfos,
      showCreateBtn: false,
      selectFn(departments) {
        _this.setState({
          departmentInfos: departments,
        });
      },
    });
  };
  // 添加职位
  dialogSelectJobFn = e => {
    const { projectId } = this.props;
    new DialogSelectJob({
      projectId,
      onSave: data => {
        this.setState({
          jobInfos: data,
          // idAct: data[0].departmentId
        });
      },
    });
  };

  renderInvite() {
    const { inviteType, editable, autonomously, autonomouslyPasswrod, errors } = this.state;
    const isInvite = inviteType === 'invite';
    const { md = {} } = window;
    const { global = {} } = md;
    const { SysSettings = {} } = global;
    const { passwordRegexTip, passwordRegex } = SysSettings;
    return editable ? (
      <div className="formTable">
        <div className="formGroup mBottom25">
          <span className="formLabel pTop2">
            {_l('添加方式')}
            {/* <span className="TxtMiddle Red">*</span> */}
          </span>
          <Radio
            className="mRight25"
            checked={isInvite}
            onClick={this.changeInviteType('invite')}
            text={_l('邀请加入')}
          />
          <Radio checked={!isInvite} onClick={this.changeInviteType('autonomously')} text={_l('自主创建')} />
        </div>
        {!isInvite ? (
          <div className="formGroup">
            <div className="formGroup">
              <span className="formLabel">{<span>{_l('登录账号')}</span>}</span>
              {editable ? (
                <input
                  type="text"
                  className={classNames('formControl', { error: errors.autonomously && errors.autonomously.msg })}
                  ref={autonomously => (this.autonomously = autonomously)}
                  placeholder={_l('请输入')}
                  onChange={this.handleFieldInput('autonomously')}
                  onBlur={this.handleFieldBlur('autonomously')}
                  onFocus={this.clearError('autonomously')}
                />
              ) : null}
              <span
                className={classNames('Block Red LineHeight25', {
                  Hidden: errors.autonomously && errors.autonomously.msg,
                  pTop25: !errors.autonomously,
                })}
              >
                {errors.autonomously && errors.autonomously.msg}
              </span>
            </div>
            {
              <TextInput
                type="password"
                value={autonomouslyPasswrod}
                placeholder={passwordRegexTip || _l('密码，8-20位，必须含字母+数字')}
                label={<span>{_l('初始密码')}</span>}
                onFocus={this.clearError('autonomouslyPasswrod')}
                onChange={this.handleFieldInput('autonomouslyPasswrod')}
                onBlur={this.handleFieldBlur('autonomouslyPasswrod')}
                error={errors.autonomouslyPasswrod}
              />
            }
          </div>
        ) : null}
        {isInvite ? (
          <div className="formGroup">
            <span className="formLabel">
              {_l('手机或邮箱')}
              <span className="TxtMiddle mLeft5 Gray_9d">( {_l('需已配置对应服务')} )</span>
            </span>
            {editable ? (
              <input
                type="text"
                className={classNames('formControl', { error: errors.invite && errors.invite.msg })}
                ref={invite => (this.invite = invite)}
                placeholder={_l('请输入')}
                onChange={this.handleFieldInput('invite')}
                onBlur={this.handleFieldBlur('invite')}
                onFocus={this.clearError('invite')}
              />
            ) : null}
            <span
              className={classNames('Block Red LineHeight25', {
                Hidden: errors.invite && errors.invite.msg,
                pTop25: !errors.invite,
              })}
            >
              {errors.invite && errors.invite.msg}
            </span>
          </div>
        ) : null}
      </div>
    ) : null;
  }

  renderMoreInfo() {
    const { job, jobNumber, contactPhone, errors, isUploading } = this.state;
    const disabled = isUploading ? 'disabled' : '';
    return (
      <div className={'formTable'}>
        <div className="formGroup mBottom25">
          <span className="formLabel">{_l('工作地点')}</span>
          <div className="workSiteBox">
            <input type="hidden" placeholder={_l('')} ref={input => (this.workSiteInput = input)} />
          </div>
        </div>
        <TextInput
          label={_l('工号')}
          value={jobNumber}
          placeholder={_l('')}
          onChange={this.handleFieldInput('jobNumber')}
        />
        <TextInput
          label={_l('工作电话')}
          value={contactPhone}
          onChange={this.handleFieldInput('contactPhone')}
          placeholder={_l('请输入工作电话')}
          error={errors.contactPhone}
          onFocus={this.clearError('contactPhone')}
          maxLength="32"
        />
      </div>
    );
  }

  render() {
    const {
      editable,
      user,
      moreInfo,
      departmentInfos,
      userName,
      autonomouslyPasswrod,
      errors,
      isUploading,
      jobInfos,
      inviteType,
      jobs = [],
      autonomously,
    } = this.state;

    return (
      <div className="dialogContent_invite">
        <div className="formTable">
          <TextInput
            label={_l('姓名')}
            field={'userName'}
            value={userName}
            editable={editable}
            isRequired={true}
            placeholder={_l('')}
            onChange={this.handleFieldInput('userName')}
            onBlur={this.handleFieldBlur('userName')}
            error={editable ? errors.userName : errors.user}
            onFocus={this.clearError('userName')}
          >
            {!editable && user ? (
              <span className="userLabel">
                <img src={user.avatar} />
                <span className="userLabelName">{user.fullname}</span>
                <span className="mLeft5 icon-closeelement-bg-circle Font14 Gray_c" onClick={this.clearSelectUser()} />
              </span>
            ) : null}
            <Tooltip title={_l('从通讯录添加')}>
              <span
                className="icon-topbar-addressList Font16 selectUser ThemeHoverColor3"
                onClick={this.dialogSelectUserHandler}
              />
            </Tooltip>
          </TextInput>
        </div>
        {this.renderInvite()}
        <div className="formTable">
          <div className="formGroup">
            <span className="formLabel">{_l('部门')}</span>
            {departmentInfos.map((item, i) => {
              return (
                <span className="itemSpan mAll5">
                  {item.departmentName}
                  {i === 0 && <span className="isTopIcon">主</span>}
                  <div className="moreOption">
                    <Icon
                      className="Font14 Hand Gray_bd"
                      icon="moreop"
                      onClick={e => {
                        this.setState(
                          {
                            isShowAct: !this.state.isShowAct,
                          },
                          () => {
                            if (this.state.isShowAct) {
                              this.setState({
                                idAct: item.departmentId,
                              });
                            }
                          },
                        );
                      }}
                    />
                    {this.state.isShowAct && this.state.idAct === item.departmentId && (
                      <Act
                        onClickAwayExceptions={[]}
                        onClickAway={() =>
                          this.setState({
                            isShowAct: false,
                          })
                        }
                        isPosition={false}
                        isTop={i === 0}
                        deleteFn={() => {
                          let list = departmentInfos.filter(it => it.departmentId !== item.departmentId);
                          this.setState({
                            isShowAct: false,
                            idAct: '',
                            departmentInfos: list,
                          });
                        }}
                        setToTop={() => {
                          let list = departmentInfos.filter(it => it.departmentId !== item.departmentId);
                          let data = departmentInfos.find(it => it.departmentId === item.departmentId);
                          list.unshift(data);
                          this.setState({
                            isShowAct: false,
                            idAct: '',
                            departmentInfos: list,
                          });
                        }}
                        isShowAct={this.state.isShowAct}
                      />
                    )}
                  </div>
                </span>
              );
            })}
            <Icon
              className="Font26 Hand Gray_9e mAll5 TxtMiddle"
              icon="task_add-02"
              onClick={e => this.dialogSelectDeptFn(e)}
            />
            {/* <span className="formControl Hand" onClick={(e)=>this.dialogSelectDeptFn(e)}>
              {departmentInfos.departmentName || departmentInfos.companyName}
              <span className="icon-arrow-down-border Font16 selectDept" />
            </span> */}
          </div>
          <div className="formGroup mBottom25">
            <span className="formLabel mTop5">{_l('职位')}</span>
            <div className="jobBox">
              {_.map(jobInfos, item => {
                return (
                  <span className="itemSpan mAll5">
                    {item.jobName}
                    <div className="moreOption">
                      <Icon
                        className="Font14 Hand Gray_bd"
                        icon="moreop"
                        onClick={e => {
                          this.setState(
                            {
                              isShowAct: !this.state.isShowAct,
                            },
                            () => {
                              if (this.state.isShowAct) {
                                this.setState({
                                  idAct: item.jobId,
                                });
                              }
                            },
                          );
                        }}
                      />
                      {this.state.isShowAct && this.state.idAct === item.jobId && (
                        <Act
                          onClickAwayExceptions={[]}
                          onClickAway={() =>
                            this.setState({
                              isShowAct: false,
                              idAct: '',
                            })
                          }
                          isPosition={true}
                          isTop={false}
                          deleteFn={() => {
                            this.setState({
                              isShowAct: false,
                              idAct: '',
                              jobInfos: this.state.jobInfos.filter(it => it.jobId !== item.jobId),
                            });
                          }}
                          isShowAct={this.state.isShowAct}
                        />
                      )}
                    </div>
                  </span>
                );
              })}
              <span className="jobChooseIcon Relative">
                <Icon
                  className="Font26 Hand Gray_9e mAll5 TxtMiddle"
                  icon="task_add-02"
                  onClick={e => {
                    this.dialogSelectJobFn();
                  }}
                />
                {/*{jobs.length <= 0 && <React.Fragment>
                  <Icon className="Font26 Hand Gray_9e mAll5 TxtMiddle Red" icon="task-folder-message" />
                  <span className='Red'>{_l('尚未配置职位')}</span>
                  <span className='Gray_75'>{_l('前往创建')}</span>
                </React.Fragment>} */}
              </span>
            </div>
          </div>
        </div>
        <div className="ThemeColor3 Hand mTop20 mBottom25" onClick={this.toggleShowMoreInfo()}>
          <span className={moreInfo ? 'icon-arrow-up' : 'icon-arrow-down'} />{' '}
          <span className="mLeft5"> {moreInfo ? _l('收起更多') : _l('展开更多')} </span>
        </div>
        {moreInfo ? this.renderMoreInfo(moreInfo) : null}
        <div className="btnGroups">
          <span className="Hand ThemeHoverColor3" onClick={this.closeDialog}>
            {_l('取消')}
          </span>
          <a
            className="btnBootstrap btnBootstrap-small mLeft25"
            href="javascript:void(0);"
            style={{
              lineHeight: '36px',
              height: '36px',
              padding: '0 24px',
              borderRadius: '32px',
              border: '1px solid #2196F3',
              background: '#fff',
              color: '#2196F3',
            }}
            disabled={isUploading}
            onClick={this.handleSubmit(true)}
          >
            {_l('继续添加')}
          </a>
          <a
            className="btnBootstrap btnBootstrap-small mLeft25"
            href="javascript:void(0);"
            disabled={isUploading}
            style={{
              lineHeight: '36px',
              height: '36px',
              padding: '0 24px',
              borderRadius: '32px',
              background: '#2196F3',
              color: '#fff',
            }}
            onClick={this.handleSubmit()}
          >
            {_l('添加')}
          </a>
        </div>
      </div>
    );
  }
}

module.exports = function(container, props) {
  ReactDom.render(<Main {...props} />, container);
};
