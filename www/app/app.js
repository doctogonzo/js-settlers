var app = angular.module('JSSettlers', ['ui.router', 'ngAnimate', 'ngMaterial']);

app.run(['$window',
    function($window) {

    }]);

app.config(['$stateProvider', '$urlRouterProvider',
    function($stateProvider, $urlRouterProvider){
        //$urlRouterProvider.otherwise('/groups');
        //
        //$stateProvider
        //    .state('groups', {
        //        url: '/groups',
        //        templateUrl: 'app/groups/view.html',
        //        controller: 'groupsCtrl'
        //    });
    }]);