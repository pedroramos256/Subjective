// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

contract Subjective {

    struct Contract {
        uint256 price;
        uint256 not_delivered_penalty;
        uint quotient;
        uint max_evaluation;

        address payable buyer;

        uint256 buyer_upfront;
        bool buyer_payed_upfront;

        uint buyer_evaluation;
        bool buyer_evaluated;

        address payable seller;

        uint256 seller_upfront;
        bool seller_payed_upfront;

        uint seller_auto_evaluation;
        bool seller_evaluated;

        address payable third_party;

        uint256 start_time;
        uint256 upfront_time;
        uint256 evaluation_time;

        bool withdrawn; 
    }

    mapping(address => mapping(uint => Contract)) owners;
    mapping(address => uint) owners_contract_count; //if it doesn't exist yet, it maps to 0

    event Deal(address _owner, address _second_party, address _third_party, uint _index);

    constructor(){}

    modifier OnlyTwoParties(address owner,uint index) {
        require(msg.sender == owners[owner][index].buyer || msg.sender == owners[owner][index].seller,"Only the two parties involved are allowed.");
        _;
    }

    function createContract(address payable _second_party, address payable _third_party,bool _is_seller,
        uint256 _price, uint256 _not_delivered_penalty, uint _quotient, uint _max_evaluation, 
        uint256 _upfront_time, uint256 _evaluation_time, bool _pay_upfront, uint _evaluation) public payable{
        
        require(_upfront_time <= 30 days,"Time to pay upfront value should be smaller than 30 days.");
        require(_evaluation_time <= 365 days,"Time to evaluate should be smaller than 365 days.");
        require(_evaluation > _max_evaluation || _pay_upfront,"Upfront must be payed before evaluation.");

        address payable _seller;
        address payable _buyer;
        if(_is_seller) {
            _seller = payable(msg.sender);
            _buyer = _second_party;
        }
        else{
            _buyer = payable(msg.sender);
            _seller = _second_party;
        }

        owners[msg.sender][owners_contract_count[msg.sender]] = Contract(
            _price,
            _not_delivered_penalty,
            _quotient,
            _max_evaluation,
            _buyer,
            _price+_price/_quotient,
            false,
            0,
            false,
            _seller,
            _not_delivered_penalty+_price/_quotient,
            false,
            0,
            false,
            _third_party,
            block.timestamp,
            _upfront_time,
            _evaluation_time,
            false
        );

        emit Deal(msg.sender,_second_party,_third_party,owners_contract_count[msg.sender]);
        
        //copied from upfront function
        if(_pay_upfront){
            Contract storage c = owners[msg.sender][owners_contract_count[msg.sender]];
            if(msg.sender == _buyer){
                require(msg.value == c.buyer_upfront,"Incorrect buyer upfront value.");
                c.buyer_payed_upfront = true;
            }else{
                require(msg.value == c.seller_upfront,"Incorrect seller upfront value.");
                c.seller_payed_upfront = true;   
            }
            if(_evaluation <= _max_evaluation){
                if(msg.sender == _buyer){
                    c.buyer_evaluation = _evaluation;
                    c.buyer_evaluated == true;
                }else{
                    c.seller_auto_evaluation = _evaluation;
                    c.seller_evaluated == true;
                }
            }
        }

        owners_contract_count[msg.sender]++;

    }

    function getContract(address owner,uint index) public view returns (bool is_seller, uint256 price, uint256 not_delivered_penalty, uint max_evaluation, uint quotient){
        Contract storage c = owners[owner][index];
        if(msg.sender == c.seller)
            is_seller = true;
        else is_seller = false;

        price = c.price;
        not_delivered_penalty = c.not_delivered_penalty;
        max_evaluation = c.max_evaluation;
        quotient = c.quotient;
    }

    function upfront(address owner,uint index) public payable OnlyTwoParties(owner,index) {
        
        Contract storage c = owners[owner][index];
        require(block.timestamp <= c.start_time+c.upfront_time,"Upfront deadline surpassed.");
        
        if(msg.sender == c.buyer){
            require(!c.buyer_payed_upfront,"Buyer already payed upfront.");
            require(msg.value == c.buyer_upfront,"Incorrect buyer upfront value.");
            c.buyer_payed_upfront = true;
        }
        else{
            require(!c.seller_payed_upfront,"Seller already payed upfront.");
            require(msg.value == c.seller_upfront,"Incorrect seller upfront value.");
            c.seller_payed_upfront = true;
        }
    }

    function evaluate(uint evaluation, bool pay_upfront, address owner,uint index) public OnlyTwoParties(owner,index) payable{
        
        Contract storage c = owners[owner][index];

        require(block.timestamp <= c.start_time+c.evaluation_time,"Evaluation deadline surpassed.");
        require(evaluation <= c.max_evaluation,"Evaluation bigger than max evaluation.");

       
        //copied from upfront function
        if(pay_upfront){
            require(block.timestamp <= c.start_time+c.upfront_time,"Upfront deadline surpassed.");
            
            if(msg.sender == c.buyer){
                require(!c.buyer_payed_upfront,"Buyer already payed upfront.");
                require(msg.value == c.buyer_upfront,"Incorrect buyer upfront value.");
                c.buyer_payed_upfront = true;
            }
            else{
                require(!c.seller_payed_upfront,"Seller already payed upfront.");
                require(msg.value == c.seller_upfront,"Incorrect seller upfront value.");
                c.seller_payed_upfront = true;
            }
        }
        
       
        if(msg.sender == c.seller){
            require(c.seller_payed_upfront,"Upfront must be payed before evaluation.");
            require(!c.seller_evaluated,"Seller already evaluated.");
            c.seller_auto_evaluation = evaluation;
            c.seller_evaluated = true;
        }
        else{
            require(c.buyer_payed_upfront,"Upfront must be payed before evaluation.");
            require(!c.buyer_evaluated,"Buyer already evaluated.");
            c.buyer_evaluation = evaluation;
            c.buyer_evaluated = true;
        }
        if(c.seller_evaluated && c.buyer_evaluated){
            uint amount;
            if(c.buyer_evaluation >= c.seller_auto_evaluation){
                amount = (c.price+c.not_delivered_penalty)*(c.buyer_evaluation+c.seller_auto_evaluation)/c.max_evaluation/2;
                c.seller.transfer(c.seller_upfront+amount-c.not_delivered_penalty);
                c.buyer.transfer(c.buyer_upfront-amount+c.not_delivered_penalty);
            }
            else{
                amount = (c.price+c.not_delivered_penalty)*(c.seller_auto_evaluation-c.buyer_evaluation)/c.max_evaluation/c.quotient;
                c.seller.transfer(c.seller_upfront+(c.price+c.not_delivered_penalty)*c.buyer_evaluation/c.max_evaluation-amount-c.not_delivered_penalty);
                c.buyer.transfer(c.buyer_upfront-(c.price+c.not_delivered_penalty)*c.seller_auto_evaluation/c.max_evaluation-amount+c.not_delivered_penalty);
                c.third_party.transfer(address(this).balance);
            }
            c.withdrawn = true;
        }
    }

    function withdraw(address owner,uint index) public payable{

        Contract storage c = owners[owner][index];

        require(!c.withdrawn,"Money already withdrawn.");
        require(msg.sender == c.buyer || msg.sender == c.seller || msg.sender == c.third_party,
            "Only the three parties are allowed to withdraw.");

        if(msg.sender == c.third_party){
            require(block.timestamp > c.start_time+c.evaluation_time+7 days,"Third party must wait until the end of the deal.");
            c.third_party.transfer(address(this).balance);
        }
        else if(c.buyer_payed_upfront && !c.seller_payed_upfront){
            require(block.timestamp > c.start_time+c.upfront_time,"Upfront time is not yet finished.");
            c.buyer.transfer(c.buyer_upfront);
        }
        else if(!c.buyer_payed_upfront && c.seller_payed_upfront){
            require(block.timestamp > c.start_time+c.upfront_time,"Upfront time is not yet finished.");
            c.seller.transfer(c.seller_upfront);
        }
        else if(c.buyer_payed_upfront && c.seller_payed_upfront){
            require(block.timestamp > c.start_time+c.evaluation_time,"Evaluation time is not yet finished.");
            
            if(msg.sender == c.seller){
                c.seller.transfer(c.seller_upfront+c.price);
            }
            else{
                c.buyer.transfer(c.buyer_upfront);
            }
            c.third_party.transfer(address(this).balance);
        }
        c.withdrawn = true;
    }
}
