import React from "react";
import PropTypes from "prop-types";
import classNames from "classnames";

import "./input-form-category-button.scss";

const InputFormCategoryButton = props => {
  const cn = {
    base: classNames("input-form-category-button", {
      "input-form-category-button--hidden": props.isCategoryMenuCollapsed,
    }),
    imageContainer: classNames("input-form-category-button__image-container", {
      "input-form-category-button__image-container--active": props.isSelected,
    }),
    labelContainer: classNames("input-form-category-button__label-text", {
      "input-form-category-button__label-text--active": props.isSelected,
    }),
    expandCategoriesButton: classNames(
      "input-form-category-button__expand-categories-button",
      {
        "input-form-category-button__expand-categories-button--hidden":
          props.isSingleCategory || !props.isSelected,
      }
    ),
  };

  return (
    <div className={cn.base}>
      <input
        className="input-form-category-button__input"
        checked={props.isSelected}
        id={props.categoryConfig.category}
        type="radio"
        name="input-form-category-buttons"
        value={props.categoryConfig.category}
        onChange={props.onCategoryChange}
      />
      <label
        className={"input-form-category-button__label"}
        htmlFor={props.categoryConfig.category}
      >
        <span className={cn.imageContainer}>
          <img
            className="input-form-category-button__image"
            src={props.categoryConfig.icon_url}
          />
        </span>
        <span className={cn.labelContainer}>{props.categoryConfig.label}</span>
      </label>
      <button
        className={cn.expandCategoriesButton}
        type="button"
        onClick={props.onExpandCategories}
      />
    </div>
  );
};

InputFormCategoryButton.propTypes = {
  categoryConfig: PropTypes.object.isRequired,
  isCategoryMenuCollapsed: PropTypes.bool.isRequired,
  isSelected: PropTypes.bool.isRequired,
  isSingleCategory: PropTypes.bool.isRequired,
  onCategoryChange: PropTypes.func.isRequired,
  onExpandCategories: PropTypes.func.isRequired,
};

export default InputFormCategoryButton;