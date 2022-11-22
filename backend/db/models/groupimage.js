'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class GroupImage extends Model {
   
    static associate(models) {
      GroupImage.hasOne(
        models.Group,
        {foreignKey: 'groupId'}
      )
    }
  }
  GroupImage.init({
    groupId: {
      allowNull: false,
      type: DataTypes.INTEGER},
    url: {
      allowNull: false,
      type: DataTypes.STRING
    },
    preview: {
      allowNull: false,
      type: DataTypes.BOOLEAN
    }
  }, {
    sequelize,
    modelName: 'GroupImage',
  });
  return GroupImage;
};