// TODO: localization in this component.

import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Map as ImmutableMap,
  OrderedMap as ImmutableOrderedMap,
} from "immutable";
import emitter from "../../utils/emitter";

import FormField from "../form-fields/form-field";
import SecondaryButton from "../ui-elements/secondary-button";
import PlaceDetailSurveyResponse from "./place-detail-survey-response";
import WarningMessagesContainer from "../ui-elements/warning-messages-container";
import Avatar from "../ui-elements/avatar";

import constants from "../../constants";
import { placeDetailSurvey as messages } from "../../messages";

import "./place-detail-survey.scss";

const Util = require("../../js/utils.js");

class PlaceDetailSurvey extends Component {
  constructor(props) {
    super(props);
    this.state = {
      fields: this.initializeFields(),
      isFormSubmitting: false,
      formValidationErrors: new Set(),
      showValidityStatus: false,
    };
  }

  componentWillMount() {
    emitter.addListener("place-detail-survey:save", () => {
      this.setState({
        fields: this.initializeFields(),
        isFormSubmitting: false,
        formValidationErrors: new Set(),
        showValidityStatus: false,
      });
    });
  }

  componentWillUnmount() {
    emitter.removeAllListeners("place-detail-survey:save");
  }

  initializeFields() {
    return this.props.surveyConfig.items.reduce((fields, field) => {
      fields = fields.set(
        field.name,
        ImmutableMap()
          .set(constants.FIELD_STATE_RENDER_KEY, Math.random())
          .set(constants.FIELD_STATE_VALUE_KEY, "")
      );
      return fields;
    }, ImmutableOrderedMap());
  }

  onFieldChange({ fieldName, fieldStatus, isInitializing }) {
    fieldStatus = fieldStatus.set(
      constants.FIELD_STATE_RENDER_KEY,
      this.state.fields.get(fieldName).get(constants.FIELD_STATE_RENDER_KEY)
    );
    this.setState(({ fields }) => ({
      fields: fields.set(fieldName, fieldStatus),
      updatingField: fieldName,
      isInitializing: isInitializing,
    }));
  }

  onSubmit(evt) {
    evt.preventDefault();

    const newValidationErrors = this.state.fields
      .filter(value => !value.get(constants.FIELD_STATE_VALIDITY_KEY))
      .reduce((newValidationErrors, invalidField) => {
        return newValidationErrors.add(
          invalidField.get(constants.FIELD_STATE_VALIDITY_MESSAGE_KEY)
        );
      }, new Set());

    if (newValidationErrors.size === 0) {
      const attrs = this.state.fields
        .filter(
          val =>
            val.get(constants.FIELD_STATE_FIELD_TYPE_KEY) !==
            constants.SUBMIT_FIELD_TYPENAME
        )
        .map(val => val.get(constants.FIELD_STATE_VALUE_KEY))
        .toJS();
      Util.log("USER", "place", "submit-reply-btn-click");

      this.props.onSurveyModelCreate(attrs, {
        wait: true,
        success: model => {
          Util.log(
            "USER",
            "place",
            "successfully-reply",
            this.props.getLoggingDetails()
          );
          this.props.onModelIO(constants.SURVEY_MODEL_IO_END_SUCCESS_ACTION);
          emitter.emit("place-detail-survey:save");
        },
        error: () => {
          // TODO: User error feedback.
          Util.log(
            "USER",
            "place",
            "fail-to-reply",
            this.props.getLoggingDetails()
          );
        },
      });
    } else {
      this.setState({
        formValidationErrors: newValidationErrors,
        showValidityStatus: true,
      });
    }
  }

  render() {
    const numSubmissions = this.props.surveyModels.size;
    return (
      <div className="place-detail-survey">
        <div className="place-detail-survey__header-bar">
          <h4 className="place-detail-survey__num-comments-header">
            {numSubmissions}{" "}
            {numSubmissions === 1
              ? this.props.surveyConfig.response_name
              : this.props.surveyConfig.response_plural_name}
          </h4>
          <SecondaryButton className="place-detail-survey__leave-comment-button">
            {this.props.surveyConfig.form_link_text}
          </SecondaryButton>
          <hr className="place-detail-survey__horizontal-rule" />
        </div>
        <div className="place-detail-survey-responses">
          {this.props.surveyModels.map((attributes, i) => {
            return (
              <PlaceDetailSurveyResponse
                key={i}
                modelId={attributes.get(constants.MODEL_ID_PROPERTY_NAME)}
                onMountTargetResponse={this.props.onMountTargetResponse}
                scrollToResponseId={this.props.scrollToResponseId}
                surveyConfig={this.props.surveyConfig}
                attributes={attributes}
                placeConfig={this.props.placeConfig}
                submitter={this.props.submitter}
              />
            );
          })}
        </div>
        <WarningMessagesContainer
          errors={Array.from(this.state.formValidationErrors)}
          headerMsg={messages.validationErrorHeaderMsg}
        />
        <form
          className="place-detail-survey__form"
          onSubmit={this.onSubmit.bind(this)}
        >
          {this.state.fields
            .map((fieldState, fieldName) => (
              <FormField
                key={fieldState.get(constants.FIELD_STATE_RENDER_KEY)}
                isInitializing={this.state.isInitializing}
                fieldConfig={this.props.surveyConfig.items.find(
                  field => field.name === fieldName
                )}
                updatingField={this.state.updatingField}
                showValidityStatus={this.state.showValidityStatus}
                disabled={this.state.isFormSubmitting}
                onFieldChange={this.onFieldChange.bind(this)}
                fieldState={fieldState}
              />
            ))
            .toArray()}
        </form>
        {this.props.currentUser ? (
          <span className="place-detail-survey__submit-user-info">
            <Avatar size="small" src={this.props.currentUser.avatar_url} />
            <span className="place-detail-survey__username">
              {this.props.currentUser.name}
            </span>
            <a
              className="place-detail-survey__logout-button"
              href={this.props.apiRoot + "users/logout/"}
            >
              {messages.logOut}
            </a>
          </span>
        ) : null}
      </div>
    );
  }
}

PlaceDetailSurvey.propTypes = {
  apiRoot: PropTypes.string.isRequired,
  getLoggingDetails: PropTypes.func.isRequired,
  onModelIO: PropTypes.func.isRequired,
  onMountTargetResponse: PropTypes.func.isRequired,
  scrollToResponseId: PropTypes.string,
  surveyModels: PropTypes.object.isRequired,
  currentUser: PropTypes.object,
  onSurveyModelCreate: PropTypes.func.isRequired,
  placeConfig: PropTypes.object.isRequired,
  submitter: PropTypes.object.isRequired,
  surveyConfig: PropTypes.object.isRequired,
};

export default PlaceDetailSurvey;