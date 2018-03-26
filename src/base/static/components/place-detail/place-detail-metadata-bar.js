// TODO: replace moment global.
// TODO: JSX localization in this component.

import React from "react";
import PropTypes from "prop-types";

import Avatar from "../ui-elements/avatar";
import ActionTime from "../ui-elements/action-time";
import SubmitterName from "../ui-elements/submitter-name";

import constants from "../../constants";

import "./place-detail-metadata-bar.scss";

const PlaceDetailMetadataBar = props => {
  return (
    <div className="place-detail-metadata-bar">
      <Avatar
        src={props.submitter.avatar_url}
        className="place-detail-metadata-bar__avatar"
      />
      <div className="place-detail-metadata-bar__details-container">
        <p className="place-detail-metadata-bar__action-text">
          <SubmitterName
            submitter={props.submitter}
            anonymousName={props.anonymousName}
          />{" "}
          {props.actionText} this{" "}
          {
            props.placeTypes[
              props.placeModel.get(constants.LOCATION_TYPE_PROPERTY_NAME)
            ].label
          }
        </p>
        <a
          href={
            "/" +
            props.placeModel.get(constants.DATASET_SLUG_PROPERTY_NAME) +
            "/" +
            props.placeModel.get(constants.MODEL_ID_PROPERTY_NAME)
          }
          className="place-detail-metadata-bar__created-datetime"
        >
          <ActionTime
            time={props.placeModel.get(
              constants.CREATED_DATETIME_PROPERTY_NAME
            )}
          />
        </a>
        <p className="place-detail-metadata-bar__survey-count">
          {props.surveyModels.size}{" "}
          {props.surveyModels.size === 1
            ? props.surveyConfig.response_name
            : props.surveyConfig.response_plural_name}
        </p>
      </div>
    </div>
  );
};

PlaceDetailMetadataBar.propTypes = {
  actionText: PropTypes.string.isRequired,
  avatarSrc: PropTypes.string,
  placeModel: PropTypes.object.isRequired,
  surveyModels: PropTypes.object.isRequired,
  anonymousName: PropTypes.string.isRequired,
  placeTypes: PropTypes.object.isRequired,
  submitter: PropTypes.object.isRequired,
  surveyConfig: PropTypes.object.isRequired,
};

export default PlaceDetailMetadataBar;
