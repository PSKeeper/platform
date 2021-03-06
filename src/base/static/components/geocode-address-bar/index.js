import React, { Component } from "react";
import PropTypes from "prop-types";

import { translate } from "react-i18next";

import "./index.scss";

import GeocodingField from "../form-fields/types/geocoding-field";

class GeocodeAddressBar extends Component {
  constructor(props) {
    super(props);

    this.state = {
      value: "",
      isTriggeringGeocode: false,
    };
  }

  onChange(fieldName, fieldValue) {
    this.setState({
      value: fieldValue,
      isTriggeringGeocode: false,
    });
  }

  onSubmit(evt) {
    evt.preventDefault();
    this.setState({
      isTriggeringGeocode: true,
    });
  }

  render() {
    return (
      <form className="geocode-address-bar" onSubmit={this.onSubmit.bind(this)}>
        <GeocodingField
          mapConfig={this.props.mapConfig}
          onChange={this.onChange.bind(this)}
          name="geocode-address-bar"
          placeholder={this.props.t("placeholderMsg")}
          isTriggeringGeocode={this.state.isTriggeringGeocode}
          value={this.state.value}
        />
      </form>
    );
  }
}

GeocodeAddressBar.propTypes = {
  mapConfig: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
};

export default translate("GeocodeAddressBar")(GeocodeAddressBar);
